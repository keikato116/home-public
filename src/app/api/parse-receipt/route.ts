import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { imageBase64, mediaType } = await request.json();
  if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mediaType as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `This is a Japanese receipt. Extract:
1. Store/vendor name (short name, e.g. "セブンイレブン")
2. Purchase date as YYYY-MM-DD (use ${new Date().toISOString().split("T")[0]} if not visible)
3. Total amount paid in JPY (integer, the final total)

Return ONLY valid JSON, no markdown:
{"store": "店名", "date": "2026-05-28", "total": 1580}`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "parse failed" }, { status: 422 });
    return NextResponse.json(JSON.parse(match[0]));
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
