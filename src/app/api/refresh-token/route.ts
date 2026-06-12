import { NextResponse } from "next/server";
import { requestGoogleTokenRefresh } from "@/lib/server/google";

export async function POST(request: Request) {
  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "missing_server_config" }, { status: 503 });
  }

  const { ok, status, data } = await requestGoogleTokenRefresh(refreshToken);

  if (!ok) {
    const googleError = (data.error as string) ?? "unknown";
    return NextResponse.json(
      { error: "Failed to refresh token", googleError },
      { status: status === 400 ? 400 : 401 }
    );
  }

  return NextResponse.json({
    accessToken: data.access_token,
    idToken: data.id_token ?? null,
    expiresIn: data.expires_in ?? 3500,
  });
}
