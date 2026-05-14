import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "missing_server_config" }, { status: 503 });
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Failed to refresh token", googleError: errData.error ?? "unknown" },
      { status: 401 }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    accessToken: data.access_token,
    idToken: data.id_token ?? null,
    expiresIn: data.expires_in ?? 3500,
  });
}
