"use client";

import { createClient } from "@/lib/supabase/client";
import {
  LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
  LS_CACHED_USER, GOOGLE_CALENDAR_SCOPE,
} from "@/lib/constants";
import { startOAuth, startLinkIdentity } from "@/lib/nativeAuth";

// Google access-token lifecycle: storage, refresh, silent re-auth.
// Kept separate from authStore (which owns session/household state);
// authStore is accessed lazily to avoid a static import cycle.

let refreshInFlight: Promise<string | null> | null = null;

export function storeAccessToken(token: string, expiresInSec?: number) {
  localStorage.setItem(LS_GOOGLE_TOKEN, token);
  const seconds = expiresInSec && expiresInSec > 0 ? expiresInSec : 3300;
  localStorage.setItem(LS_GOOGLE_TOKEN_EXPIRY, String(Date.now() + seconds * 1000));
}

/**
 * Google のログインを始める（カレンダー読み取りの権限つき）。
 * iOS アプリでは Safari に出す。分岐は startOAuth 側にある。
 */
export function startGoogleOAuth() {
  return startOAuth("google", {
    scopes: GOOGLE_CALENDAR_SCOPE,
    queryParams: { access_type: "offline", prompt: "consent" },
  });
}

/**
 * カレンダーを繋ぐ。Apple でログインした人にも効くようにしてある。
 *
 * すでに Google でログインしている人（トークンの取り直し）は、今までどおり Google で
 * ログインし直す。同じアカウントに戻るので問題ない。
 *
 * Google を持っていない人（Apple で登録した人）は、今のアカウントに Google を紐付ける
 * （startLinkIdentity）。以前はこれが失敗したときや iOS アプリでは Google での
 * ログインに切り替えていたが、それだと Apple のアカウントとは別のアカウントに
 * 入ってしまい、世帯もデータも無い状態になっていた。だから紐付けに失敗したら
 * ログインには切り替えず、エラーにする。
 */
export async function connectGoogleCalendar(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  const hasGoogle = user?.identities?.some((i) => i.provider === "google") ?? false;
  if (!user || hasGoogle) return startGoogleOAuth();

  try {
    await startLinkIdentity("google", {
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: { access_type: "offline", prompt: "consent" },
    });
  } catch (e) {
    console.error("[google] linkIdentity failed", e);
    throw new Error("Google カレンダーを連携できませんでした。時間をおいてもう一度お試しください。");
  }
}

/**
 * Google のトークンを保存する。
 *
 * 表に直接書かず /api/tokens を通す。保存前にサーバーが暗号化するため
 * （鍵はブラウザに配れない）。名前には触らない — display_name は
 * member_profiles にあり、src/lib/displayName.ts の側だけが書く。
 */
export async function upsertUserToken(accessToken: string) {
  const refreshToken = localStorage.getItem(LS_GOOGLE_REFRESH);
  await fetch("/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      // 持っているときだけ送る。undefined なら向こうで更新対象から外れるので、
      // アクセストークンだけの更新でリフレッシュトークンを消さずに済む。
      ...(refreshToken ? { refreshToken } : {}),
    }),
  });
}

async function doRefresh(): Promise<string | null> {
  let refreshToken = localStorage.getItem(LS_GOOGLE_REFRESH);

  if (!refreshToken) {
    // localStorage may have been cleared (iOS PWA storage eviction); recover from DB.
    // 保存時に暗号化しているので、復号できるサーバー越しに取り直す。
    try {
      const res = await fetch("/api/tokens");
      if (res.ok) {
        const { refreshToken: stored } = await res.json();
        if (stored) {
          refreshToken = stored;
          localStorage.setItem(LS_GOOGLE_REFRESH, stored);
        }
      }
    } catch {}
  }

  if (!refreshToken) {
    // No refresh token anywhere — if the user is logged in, re-auth silently to get one
    if (typeof window !== "undefined" && localStorage.getItem(LS_CACHED_USER)) {
      startGoogleOAuth().catch(() => {});
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
          startGoogleOAuth().catch(() => {});
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
      upsertUserToken(accessToken).catch(() => {});
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
