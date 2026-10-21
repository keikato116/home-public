import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/entitlement";
import { fetchPublicText } from "@/lib/server/safeFetch";

// レシピの URL からタイトルと画像を取る。サーバーが利用者の指定した URL を
// 取りに行くので、ログイン必須にし、内部のアドレスには行かせない（safeFetch）。
export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const html = await fetchPublicText(String(url), {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    });

    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

    const imageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    const pageTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return NextResponse.json({
      title: titleMatch?.[1] ?? pageTitleMatch?.[1] ?? url,
      thumbnail_url: imageMatch?.[1] ?? null,
    });
  } catch {
    return NextResponse.json({ title: url, thumbnail_url: null });
  }
}
