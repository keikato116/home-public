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
            text: `This is a receipt. Extract:
1. Store/vendor name (short, e.g. "セブンイレブン", "業務スーパー")
2. Total paid amount in JPY (integer, no symbols)
3. Purchase date in YYYY-MM-DD format (if not visible, return today ${new Date().toISOString().split("T")[0]})

Return ONLY valid JSON, no markdown:
{"description":"store name","amount":1234,"date":"2026-05-28"}`,
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
