"use client";

import { createClient } from "@/lib/supabase/client";
import {
  LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
  LS_CACHED_USER, GOOGLE_CALENDAR_SCOPE,
} from "@/lib/constants";

// Google access-token lifecycle: storage, refresh, silent re-auth.
// Kept separate from authStore (which owns session/household state);
// authStore is accessed lazily to avoid a static import cycle.

let refreshInFlight: Promise<string | null> | null = null;

export function storeAccessToken(token: string, expiresInSec?: number) {
  localStorage.setItem(LS_GOOGLE_TOKEN, token);
  const seconds = expiresInSec && expiresInSec > 0 ? expiresInSec : 3300;
  localStorage.setItem(LS_GOOGLE_TOKEN_EXPIRY, String(Date.now() + seconds * 1000));
}

/** Starts the Google OAuth flow requesting calendar read access. */
export function startGoogleOAuth(supabase: ReturnType<typeof createClient>) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}

export async function upsertUserToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  householdId: string,
  accessToken: string,
  displayName: string
) {
  await supabase.from("user_tokens").upsert({
    user_id: userId,
    household_id: householdId,
    google_access_token: accessToken,
    ...(localStorage.getItem(LS_GOOGLE_REFRESH) ? { google_refresh_token: localStorage.getItem(LS_GOOGLE_REFRESH) } : {}),
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });
}

async function doRefresh(): Promise<string | null> {
  let refreshToken = localStorage.getItem(LS_GOOGLE_REFRESH);

  if (!refreshToken) {
    // localStorage may have been cleared (iOS PWA storage eviction); recover from DB
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_tokens")
          .select("google_refresh_token")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.google_refresh_token) {
          refreshToken = data.google_refresh_token;
          localStorage.setItem(LS_GOOGLE_REFRESH, data.google_refresh_token);
        }
      }
    } catch {}
  }

  if (!refreshToken) {
    // No refresh token anywhere — if the user is logged in, re-auth silently to get one
    if (typeof window !== "undefined" && localStorage.getItem(LS_CACHED_USER)) {
      startGoogleOAuth(createClient()).catch(() => {});
    }
    return null;
  }

  try {
    const res = await fetch("/api/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const googleError = err.googleError ?? "";
      // Any non-transient Google error: clear stored token and re-auth automatically
      const isNonTransient = res.status < 500;
      if (isNonTransient) {
        if (googleError === "invalid_grant" || googleError === "invalid_client") {
          localStorage.removeItem(LS_GOOGLE_REFRESH);
        }
        if (typeof window !== "undefined" && localStorage.getItem(LS_CACHED_USER)) {
          startGoogleOAuth(createClient()).catch(() => {});
        }
      }
      return null;
    }

    const { accessToken, idToken, expiresIn } = await res.json();
    if (!accessToken) return null;

    storeAccessToken(accessToken, expiresIn);
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.setState({ accessToken });

    const supabase = createClient();
    if (idToken) {
      await supabase.auth.signInWithIdToken({ provider: "google", token: idToken }).catch(() => {});
    }

    const { user, householdId } = useAuthStore.getState();
    if (user && householdId) {
      const displayName = user.user_metadata?.full_name ?? user.email ?? "";
      upsertUserToken(supabase, user.id, householdId, accessToken, displayName).catch(() => {});
    }

    return accessToken;
  } catch {
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// Returns a valid access token, refreshing proactively if expired or near expiry.
// Returns null if refresh fails (caller should prompt re-auth).
export async function ensureValidAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(LS_GOOGLE_TOKEN);
  const expiresAt = parseInt(localStorage.getItem(LS_GOOGLE_TOKEN_EXPIRY) || "0", 10);

  // Refresh if no expiry recorded (legacy), or less than 5 min remaining
  if (token && expiresAt > 0 && Date.now() < expiresAt - 5 * 60 * 1000) {
    return token;
  }

  return refreshAccessToken();
}
