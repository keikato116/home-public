import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireEntitled } from "@/lib/server/entitlement";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECIPE_IMPORT_DISH_LIMIT, RECIPE_ANALYSIS_LIMIT } from "@/lib/recipeImportLimit";
import { fetchPublicText } from "@/lib/server/safeFetch";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// レシピの読み取りは Haiku で行う。書いてあることを決まった形に書き写すだけなので、
// 上位のモデルとの差が出にくく、費用は Sonnet 4.6 の約30分の1（1回0.2〜0.3円の目安）。
//
// Haiku 5.5 は既定で考えてから答えるので:
//   - 返事の先頭が thinking ブロックのことがある → 位置ではなく type で text を拾う（textOf）
//   - 考えた分も max_tokens に数えられる → 書き出しに足りるだけ余裕を持たせる
//   - 読み取りに深い思考は要らない → effort を low にして、考える量（と費用）を抑える
//   - temperature などを指定すると 400 になる → 指定しない
const MODEL = "claude-haiku-5-5";
const EFFORT = { effort: "low" } as const;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * 読み取りを1回分使う。使えなければ 429 を返す（src/lib/recipeImportLimit.ts）。
 * マイグレーション前（関数が無い）なら数えずに通す。取り込みそのものは止めない。
 */
async function consumeAnalysis(admin: Admin, userId: string): Promise<NextResponse | null> {
  const { data, error } = await admin.rpc("use_recipe_analysis", {
    p_user: userId,
    p_dish_limit: RECIPE_IMPORT_DISH_LIMIT,
    p_analysis_limit: RECIPE_ANALYSIS_LIMIT,
  });
  if (error) {
    if (error.code === "PGRST202") {
      console.warn("[parse-recipe] use_recipe_analysis がありません。回数を数えずに通します");
      return null;
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (data === "dishes") {
    return NextResponse.json(
      { error: `今月の取り込みは${RECIPE_IMPORT_DISH_LIMIT}品までです。来月1日にまた取り込めるようになります。` },
      { status: 429 }
    );
  }
  if (data === "analyses") {
    return NextResponse.json(
      { error: "今月の読み取り回数の上限に達しました。来月1日にまた取り込めるようになります。" },
      { status: 429 }
    );
  }
  return null;
}

/** 応答から文章だけを取り出す。断られた（refusal）ときは throw。 */
function textOf(msg: Anthropic.Message): string {
  if (msg.stop_reason === "refusal") throw new Error("読み取りを断られました。別の写真やページでお試しください");
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

const CATEGORIES = ["main", "side", "soup", "rice & bowl", "pasta", "noodles", "dessert", "seasonal", "bento"];

const FIELDS = `- title: recipe name (string)
- category: one of [${CATEGORIES.join(", ")}] — pick the closest. Use "bento" for any lunch-box / bento dish or anything explicitly described as a bento item.
- subcategory: for "main" use one of [meat, fish, others]; for all other categories use null
- servings: number of servings as integer (number or null)
- cook_time_min: total cooking time in minutes as integer (number or null)
- ingredients: ONLY ingredients explicitly listed in the ingredients/materials section of the recipe. Do NOT include items mentioned in instructions, steps, or notes that are not listed in the ingredients section. One item per line (string or null)
- memo: tips, notes, or variations (string or null)`;

const SCHEMA_PROMPT = `Analyze the recipe content. There may be one or multiple recipes.
Return ONLY a valid JSON array (no markdown, no explanation) — always an array, even for a single recipe.
Each element must have:
${FIELDS}`;

function buildGroupPrompt(recipes: { title: string; ingredients: string | null }[]) {
  const n = recipes.length;
  const list = recipes.map((r, i) => {
    const hasIng = !!r.ingredients?.trim();
    return `[${i}] title: "${r.title || "(none)"}" | has_ingredients: ${hasIng}\n    ingredients preview: "${(r.ingredients ?? "").slice(0, 150)}"`;
  }).join("\n\n");
  return `You are analyzing ${n} pages scanned from a Japanese recipe book (indexed 0 to ${n - 1}).

In recipe books, ONE recipe often spans 2–4 consecutive pages:
  • Page A — COVER PAGE: large photo + title only, no ingredients list
  • Page B — RECIPE PAGE: title + ingredients + first steps
  • Page C — CONTINUATION PAGE: more steps or tips, no new title, no new ingredients

Grouping rules (in order of priority):
  1. COVER PAGE (has title, has_ingredients=false) → must join with the immediately following page(s).
  2. CONTINUATION PAGE (has_ingredients=false, title same/empty/similar to previous) → must join with the previous recipe group.
  3. Two consecutive pages are SEPARATE recipes only when BOTH have their own distinct title AND their own ingredients.

Pages:
${list}

Group all consecutive pages that belong to the same recipe.
Return ONLY a valid JSON array of groups such as [[0,1,2],[3,4]] — no markdown, no explanation.`;
}

function parseJson(raw: string) {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function POST(req: Request) {
  // レシピ取り込みは有料機能。1回ごとに Anthropic の課金が発生するので、
  // 認証と課金の両方をここで確かめる。
  const denied = await requireEntitled();
  if (denied) return denied;

  const body = await req.json();

  // 写真と URL の読み取りだけを数える。group（複数の写真を同じレシピかまとめる）は数えない。
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const counted = (body.type === "photo" || body.type === "url") && user && admin;
  if (counted) {
    const limited = await consumeAnalysis(admin, user.id);
    if (limited) return limited;
  }

  try {
    if (body.type === "photo") {
      const { imageBase64, mediaType } = body as {
        imageBase64: string;
        mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      };

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        output_config: EFFORT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: SCHEMA_PROMPT },
          ],
        }],
      });

      const raw = textOf(msg);
      const recipes = parseJson(raw);
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: null, url: null })));

    } else if (body.type === "group") {
      const { recipes } = body as { recipes: { title: string; ingredients: string | null }[] };

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        output_config: EFFORT,
        messages: [{ role: "user", content: buildGroupPrompt(recipes) }],
      });

      const raw = textOf(msg);
      const groups = parseJson(raw);
      return NextResponse.json(groups);

    } else if (body.type === "url") {
      const { url } = body as { url: string };

      // 内部のアドレスには行かせない（safeFetch）
      const html = await fetchPublicText(String(url), {
        "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/120 Safari/537.36",
      });

      const ogImage =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
        null;

      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        output_config: EFFORT,
        messages: [{
          role: "user",
          content: `The following is text extracted from a recipe webpage. ${SCHEMA_PROMPT}\n\n${text}`,
        }],
      });

      const rawUrl = textOf(msg);
      const recipes = parseJson(rawUrl);
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: ogImage, url })));
    }

    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (e) {
    // 読み取れなかった分で上限が減らないよう、1回分を戻す
    if (counted) await admin.rpc("refund_recipe_analysis", { p_user: user.id }).then(() => {}, () => {});
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
