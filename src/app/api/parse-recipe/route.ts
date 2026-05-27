import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ["main", "side", "soup", "rice & bowl", "pasta", "noodles", "dessert"];

const FIELDS = `- title: recipe name (string)
- category: one of [${CATEGORIES.join(", ")}] — pick the closest
- subcategory: for "main" use one of [meat, fish, others]; for "noodles" use one of [udon, soba, ramen]; for all other categories use null
- servings: number of servings as integer (number or null)
- cook_time_min: total cooking time in minutes as integer (number or null)
- ingredients: full ingredients list, one item per line (string or null)
- memo: tips, notes, or variations (string or null)`;

const SCHEMA_PROMPT = `Analyze the recipe content. There may be one or multiple recipes.
Return ONLY a valid JSON array (no markdown, no explanation) — always an array, even for a single recipe.
Each element must have:
${FIELDS}`;

function buildGroupPrompt(recipes: { title: string; ingredients: string | null }[]) {
  const n = recipes.length;
  const list = recipes.map((r, i) =>
    `[${i}] title: "${r.title || "no title"}"\ningredients preview: "${(r.ingredients ?? "").slice(0, 200)}"`
  ).join("\n\n");
  return `${n} recipes were extracted from ${n} consecutive recipe photos (indexed 0 to ${n - 1}).
Some adjacent recipes may be PARTS OF THE SAME RECIPE that spans multiple pages — e.g. ingredients or steps continue on the next page with no new title.

${list}

Task: group indices of recipes that belong to the same multi-page recipe. Only group CONSECUTIVE indices.
Return ONLY a valid JSON array of groups, e.g. [[0,1],[2],[3]] or [[0],[1],[2]].
No markdown, no explanation.`;
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
