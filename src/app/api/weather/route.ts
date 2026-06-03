import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") ?? request.headers.get("x-vercel-ip-latitude");
  const lon = searchParams.get("lon") ?? request.headers.get("x-vercel-ip-longitude");

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
