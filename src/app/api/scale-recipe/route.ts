import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { ingredients, baseServings, targetServings } = await req.json() as {
    ingredients: string;
    baseServings: number;
    targetServings: number;
  };

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Scale this recipe from ${baseServings} servings to ${targetServings} servings.
Rules:
- Multiply numeric quantities proportionally (${targetServings}/${baseServings})
- Keep "適量", "少々", "お好みで", "適宜" and similar vague quantities unchanged
- Keep the same format and line structure
- Return ONLY the scaled ingredients list, no explanation

Ingredients:
${ingredients}`,
      }],
    });

    const scaled = msg.content[0].type === "text" ? msg.content[0].text.trim() : ingredients;
    return NextResponse.json({ scaledIngredients: scaled });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
