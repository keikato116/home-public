import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireUser } from "@/lib/server/entitlement";

/**
 * 接続元から推定したおおよその位置。端末の位置情報は使わない（天気にしか使わない）。
 * Cloudflare Workers では request.cf に入っている。Vercel では x-vercel-ip-* ヘッダーに入る
 * （移行が終わるまで両方で動くようにしてある）。
 */
function approximateLocation(request: Request): { lat: string | null; lon: string | null } {
  try {
    const cf = getCloudflareContext().cf as { latitude?: string; longitude?: string } | undefined;
    if (cf?.latitude && cf?.longitude) return { lat: cf.latitude, lon: cf.longitude };
  } catch {
    // Cloudflare の外（Vercel・手元の next start）
  }
  return {
    lat: request.headers.get("x-vercel-ip-latitude"),
    lon: request.headers.get("x-vercel-ip-longitude"),
  };
}

export async function GET(request: Request) {
  // OpenWeatherMap の利用枠を、ログインしていない人に使わせない
  const denied = await requireUser();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const approx = approximateLocation(request);
  const lat = searchParams.get("lat") ?? approx.lat;
  const lon = searchParams.get("lon") ?? approx.lon;

  if (!lat || !lon) {
    return NextResponse.json({ error: "location unavailable" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) throw new Error("Weather API error");
    const data = await res.json();

    return NextResponse.json({
      icon: data.weather[0].icon,
      temp: Math.round(data.main.temp),
      description: data.weather[0].description,
      rain1h: data.rain?.["1h"] ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}
