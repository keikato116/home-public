import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error("Fetch failed");
    const html = await res.text();

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
