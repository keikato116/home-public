import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const scope = searchParams.get("scope") ?? "";

  const origin = request.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(new URL("/?strava=error", origin));
  }

  // Strava returns granted scopes in the callback URL.
  // If activity:read_all wasn't granted, force re-authorization.
  if (!scope.includes("activity:read_all")) {
    const clientId = process.env.STRAVA_CLIENT_ID ?? "248914";
    const redirectUri = encodeURIComponent(`${origin}/api/strava/callback`);
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&approval_prompt=force`;
    return NextResponse.redirect(new URL(authUrl));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?strava=error", origin));
  }

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?strava=error", origin));
  }

  const data = await tokenRes.json();
  const { access_token, refresh_token, expires_at, athlete } = data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/?strava=error", origin));
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("strava_tokens").upsert(
    {
      user_id: user.id,
      household_id: member?.household_id ?? null,
      athlete_id: athlete.id,
      athlete_name: `${athlete.firstname ?? ""} ${athlete.lastname ?? ""}`.trim(),
      access_token,
      refresh_token,
      expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return NextResponse.redirect(new URL("/?strava=connected", origin));
}
