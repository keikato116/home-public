"use client";

import { useEffect } from "react";
import { useStravaStore } from "@/store/stravaStore";

const STRAVA_CLIENT_ID = "247369";
const STRAVA_REDIRECT_URI = "https://homes-lime.vercel.app/api/strava/callback";

function stravaAuthUrl() {
  const redirectUri = encodeURIComponent(STRAVA_REDIRECT_URI);
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&approval_prompt=force`;
}

export function StravaSettings() {
  const { connected, athleteName, loading, init, disconnect } = useStravaStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">strava</p>
      {loading ? (
        <p className="text-[11px] text-muted-foreground">loading...</p>
      ) : connected ? (
        <div className="space-y-2">
          <p className="text-[12px]">{athleteName ?? "Connected"}</p>
          <button
            onClick={disconnect}
            className="text-[11px] text-muted-foreground tracking-wider hover:text-foreground transition-colors"
          >
            disconnect
          </button>
        </div>
      ) : (
        <a
          href={stravaAuthUrl()}
          className="text-[11px] text-muted-foreground tracking-wider hover:text-foreground transition-colors"
        >
          connect strava →
        </a>
      )}
    </div>
  );
}
