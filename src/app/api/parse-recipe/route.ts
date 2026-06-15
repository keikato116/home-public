import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const body = await req.json();

  try {
    if (body.type === "photo") {
      const { imageBase64, mediaType } = body as {
        imageBase64: string;
        mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      };

      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: SCHEMA_PROMPT },
          ],
        }],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
      const recipes = parseJson(raw);
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: null, url: null })));

    } else if (body.type === "group") {
      const { recipes } = body as { recipes: { title: string; ingredients: string | null }[] };

      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content: buildGroupPrompt(recipes) }],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
      const groups = parseJson(raw);
      return NextResponse.json(groups);

    } else if (body.type === "url") {
      const { url } = body as { url: string };

      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      });
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();

      const ogImage =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
        null;

      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);

      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `The following is text extracted from a recipe webpage. ${SCHEMA_PROMPT}\n\n${text}`,
        }],
      });

      const rawUrl = msg.content[0].type === "text" ? msg.content[0].text : "";
      const recipes = parseJson(rawUrl);
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: ogImage, url })));
    }

    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
