import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ["main", "side", "soup", "rice & bowl", "pasta", "noodles", "dessert"];

const SCHEMA_PROMPT = `Analyze the recipe content. There may be one or multiple recipes.
Return ONLY a valid JSON array (no markdown, no explanation) — always an array, even for a single recipe.
Each element must have:
- title: recipe name (string)
- category: one of [${CATEGORIES.join(", ")}] — pick the closest
- servings: number of servings as integer (number or null)
- cook_time_min: total cooking time in minutes as integer (number or null)
- ingredients: full ingredients list, one item per line (string or null)
- memo: tips, notes, or variations (string or null)`;

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
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: SCHEMA_PROMPT },
          ],
        }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      const parsed = JSON.parse(text);
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: null, url: null })));

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

      // strip tags and collapse whitespace for Claude
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);

      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `The following is text extracted from a recipe webpage. ${SCHEMA_PROMPT}\n\n${text}`,
        }],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
      const parsed = JSON.parse(raw);
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      return NextResponse.json(recipes.map((r) => ({ ...r, thumbnail_url: ogImage, url })));
    }

    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
