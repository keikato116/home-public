import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface StravaTokenRow {
  user_id: string;
  athlete_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

async function refreshStravaToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false });
  }

  const { data: row } = await supabase
    .from("strava_tokens")
    .select("user_id, athlete_name, access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ connected: false });
  }

  const tokenRow = row as StravaTokenRow;
  let { access_token, refresh_token, expires_at } = tokenRow;

  if (Date.now() / 1000 >= expires_at - 300) {
    const refreshed = await refreshStravaToken(refresh_token);
    if (!refreshed) {
      return NextResponse.json({ connected: true, activities: [], error: "token_refresh_failed" });
    }
    access_token = refreshed.access_token;
    refresh_token = refreshed.refresh_token;
    expires_at = refreshed.expires_at;

    await supabase.from("strava_tokens").upsert(
      { user_id: user.id, access_token, refresh_token, expires_at, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  const activitiesRes = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=30",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!activitiesRes.ok) {
    return NextResponse.json({ connected: true, activities: [], error: "fetch_failed" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activities: any[] = await activitiesRes.json();

  return NextResponse.json({
    connected: true,
    athleteName: tokenRow.athlete_name,
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.sport_type ?? a.type,
      startDate: a.start_date_local,
      distance: a.distance,
      movingTime: a.moving_time,
      elevationGain: a.total_elevation_gain,
      averageHeartrate: a.average_heartrate ?? null,
      kudosCount: a.kudos_count,
    })),
  });
}
