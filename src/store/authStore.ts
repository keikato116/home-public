"use client";

import { create } from "zustand";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthState {
  user: User | null;
  householdId: string | null;
  inviteCode: string | null;
  accessToken: string | null;
  loading: boolean;
  settingsOpen: boolean;
  activeTab: string;
  setHouseholdId: (id: string, inviteCode?: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
  reAuthGoogle: () => Promise<void>;
}

const TOKEN_KEY = "google_access_token";
const TOKEN_EXPIRY_KEY = "google_access_token_expires_at";
const REFRESH_KEY = "google_refresh_token";

let isSigningOut = false;
let refreshInFlight: Promise<string | null> | null = null;
let periodicRefreshInterval: ReturnType<typeof setInterval> | null = null;

function storeAccessToken(token: string, expiresInSec?: number) {
  localStorage.setItem(TOKEN_KEY, token);
  const seconds = expiresInSec && expiresInSec > 0 ? expiresInSec : 3300;
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + seconds * 1000));
}

async function upsertUserToken(
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
    ...(localStorage.getItem(REFRESH_KEY) ? { google_refresh_token: localStorage.getItem(REFRESH_KEY) } : {}),
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });
}

async function doRefresh(): Promise<string | null> {
  let refreshToken = localStorage.getItem(REFRESH_KEY);

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
          localStorage.setItem(REFRESH_KEY, data.google_refresh_token);
        }
      }
    } catch {}
  }

  if (!refreshToken) {
    // No refresh token anywhere — if the user is logged in, re-auth silently to get one
    if (typeof window !== "undefined" && localStorage.getItem("cached_user")) {
      const supabase = createClient();
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      }).catch(() => {});
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
      if (err.googleError === "invalid_grant") {
        localStorage.removeItem(REFRESH_KEY);
        if (typeof window !== "undefined") {
          // Token revoked — silently re-auth so the user never sees a manual reconnect prompt
          const supabase = createClient();
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
              scopes: "https://www.googleapis.com/auth/calendar.readonly",
              queryParams: { access_type: "offline", prompt: "consent" },
            },
          }).catch(() => {});
        }
      }
      return null;
    }

    const { accessToken, idToken, expiresIn } = await res.json();
    if (!accessToken) return null;

    storeAccessToken(accessToken, expiresIn);
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

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// Returns a valid access token, refreshing proactively if expired or near expiry.
// Returns null if refresh fails (caller should prompt re-auth).
export async function ensureValidAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || "0", 10);

  // Refresh if no expiry recorded (legacy), or less than 5 min remaining
  if (token && expiresAt > 0 && Date.now() < expiresAt - 5 * 60 * 1000) {
    return token;
  }

  return refreshAccessToken();
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  householdId: null,
  inviteCode: null,
  accessToken: null,
  loading: true,
  settingsOpen: false,
  activeTab: "home",

  setHouseholdId: (id, inviteCode) => set({ householdId: id, inviteCode: inviteCode ?? null }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  init: async () => {
    const supabase = createClient();

    const cachedUser = localStorage.getItem("cached_user");
    const cachedHouseholdId = localStorage.getItem("cached_household_id");
    const cachedInviteCode = localStorage.getItem("cached_invite_code");

    try {
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        set({
          user: parsedUser,
          householdId: cachedHouseholdId,
          inviteCode: cachedInviteCode,
          accessToken: localStorage.getItem(TOKEN_KEY),
          loading: false,
        });
        // Proactively refresh in the background so the cached token is fresh
        refreshAccessToken().catch(() => {});
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.provider_token) {
          storeAccessToken(session.provider_token);
        }
        if (session.provider_refresh_token) {
          localStorage.setItem(REFRESH_KEY, session.provider_refresh_token);
        }
        const token = session.provider_token ?? localStorage.getItem(TOKEN_KEY);

        const [{ data: member }, { data: tokenRow }] = await Promise.all([
          supabase
            .from("household_members")
            .select("household_id, households(invite_code)")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          !localStorage.getItem(REFRESH_KEY)
            ? supabase
                .from("user_tokens")
                .select("google_refresh_token")
                .eq("user_id", session.user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (tokenRow?.google_refresh_token && !localStorage.getItem(REFRESH_KEY)) {
          localStorage.setItem(REFRESH_KEY, tokenRow.google_refresh_token);
        }

        const hid = member?.household_id ?? null;
        const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

        localStorage.setItem("cached_user", JSON.stringify(session.user));
        localStorage.setItem("cached_household_id", hid ?? "");
        localStorage.setItem("cached_invite_code", ic ?? "");

        set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token, loading: false });

        if (hid && token) {
          const displayName = session.user.user_metadata?.full_name ?? session.user.email ?? "";
          await upsertUserToken(supabase, session.user.id, hid, token, displayName);
        }
      } else if (!cachedUser) {
        set({ user: null, householdId: null, inviteCode: null, accessToken: null, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      // Proactively refresh on foreground; dedupe handles concurrent calls
      ensureValidAccessToken().catch(() => {});
    });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (session.provider_token) {
          storeAccessToken(session.provider_token);
        }
        if (session.provider_refresh_token) {
          localStorage.setItem(REFRESH_KEY, session.provider_refresh_token);
        }
        const token = session.provider_token ?? localStorage.getItem(TOKEN_KEY);

        const { data: member } = await supabase
          .from("household_members")
          .select("household_id, households(invite_code)")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const hid = member?.household_id ?? null;
        const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

        localStorage.setItem("cached_user", JSON.stringify(session.user));
        localStorage.setItem("cached_household_id", hid ?? "");
        localStorage.setItem("cached_invite_code", ic ?? "");

        set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token });
        if (hid && token) {
          const displayName = session.user.user_metadata?.full_name ?? session.user.email ?? "";
          await upsertUserToken(supabase, session.user.id, hid, token, displayName);
        }
      } else if (event === "TOKEN_REFRESHED" && session?.provider_token) {
        storeAccessToken(session.provider_token);
        set({ accessToken: session.provider_token });
      } else if (event === "SIGNED_OUT") {
        if (isSigningOut) {
          isSigningOut = false;
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
          localStorage.removeItem(REFRESH_KEY);
          localStorage.removeItem("cached_user");
          localStorage.removeItem("cached_household_id");
          localStorage.removeItem("cached_invite_code");
          set({ user: null, householdId: null, inviteCode: null, accessToken: null });
        } else {
          const { data: { session: recovered } } = await supabase.auth.refreshSession();
          if (recovered) {
            localStorage.setItem("cached_user", JSON.stringify(recovered.user));
            set({ user: recovered.user });
          } else {
            localStorage.removeItem("cached_user");
            localStorage.removeItem("cached_household_id");
            localStorage.removeItem("cached_invite_code");
            set({ user: null, householdId: null, inviteCode: null, accessToken: null });
          }
        }
      }
    });

    // Proactively refresh the token every 45 minutes so it never expires mid-session
    if (periodicRefreshInterval) clearInterval(periodicRefreshInterval);
    periodicRefreshInterval = setInterval(() => {
      ensureValidAccessToken().catch(() => {});
    }, 45 * 60 * 1000);
  },

  signOut: async () => {
    if (periodicRefreshInterval) { clearInterval(periodicRefreshInterval); periodicRefreshInterval = null; }
    isSigningOut = true;
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  reAuthGoogle: async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  },
}));
