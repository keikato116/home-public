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

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let isSigningOut = false;

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
    google_refresh_token: localStorage.getItem("google_refresh_token") ?? "",
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });
}

function scheduleTokenRefresh(
  set: (state: Partial<AuthState>) => void,
  userId: string,
  householdId: string,
  displayName: string
) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const refreshToken = localStorage.getItem("google_refresh_token");
    if (!refreshToken) return;
    try {
      const res = await fetch("/api/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const { accessToken } = await res.json();
        localStorage.setItem("google_access_token", accessToken);
        set({ accessToken });
        const supabase = createClient();
        await upsertUserToken(supabase, userId, householdId, accessToken, displayName);
        scheduleTokenRefresh(set, userId, householdId, displayName);
      }
    } catch {
      refreshTimer = setTimeout(() => scheduleTokenRefresh(set, userId, householdId, displayName), 5 * 60 * 1000);
    }
  }, 45 * 60 * 1000);
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

    if (cachedUser) {
      const parsedUser = JSON.parse(cachedUser);
      const displayName = parsedUser?.user_metadata?.full_name ?? parsedUser?.email ?? "";
      set({
        user: parsedUser,
        householdId: cachedHouseholdId,
        inviteCode: cachedInviteCode,
        accessToken: localStorage.getItem("google_access_token"),
        loading: false,
      });

      const storedRefreshToken = localStorage.getItem("google_refresh_token");
      if (storedRefreshToken) {
        fetch("/api/refresh-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        }).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.accessToken) {
            localStorage.setItem("google_access_token", data.accessToken);
            set({ accessToken: data.accessToken });
          }
        }).catch(() => {});
        scheduleTokenRefresh(set, parsedUser.id, cachedHouseholdId ?? "", displayName);
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (session.provider_token) {
        localStorage.setItem("google_access_token", session.provider_token);
      }
      if (session.provider_refresh_token) {
        localStorage.setItem("google_refresh_token", session.provider_refresh_token);
      }
      const token = session.provider_token ?? localStorage.getItem("google_access_token");

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

      set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token, loading: false });

      if (hid && token) {
        const displayName = session.user.user_metadata?.full_name ?? session.user.email ?? "";
        await upsertUserToken(supabase, session.user.id, hid, token, displayName);
        if (localStorage.getItem("google_refresh_token")) {
          scheduleTokenRefresh(set, session.user.id, hid, displayName);
        }
      }
    } else if (!cachedUser) {
      // No session and no cached user — fully signed out
      set({ user: null, householdId: null, inviteCode: null, accessToken: null, loading: false });
    } else {
      // No Supabase session but we have cached user — session expired while away.
      // Keep the cached user in state so the UI stays visible; server calls will
      // trigger auth errors which surface as feature-level errors, not a full logout.
      set({ loading: false });
    }

    // Refresh Supabase session when the app comes back to the foreground
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        localStorage.setItem("cached_user", JSON.stringify(s.user));
        set({ user: s.user });
      }
    });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (session.provider_token) {
          localStorage.setItem("google_access_token", session.provider_token);
        }
        if (session.provider_refresh_token) {
          localStorage.setItem("google_refresh_token", session.provider_refresh_token);
        }
        const token = session.provider_token ?? localStorage.getItem("google_access_token");

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
          scheduleTokenRefresh(set, session.user.id, hid, displayName);
        }
      } else if (event === "TOKEN_REFRESHED" && session?.provider_token) {
        localStorage.setItem("google_access_token", session.provider_token);
        set({ accessToken: session.provider_token });
      } else if (event === "SIGNED_OUT") {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (isSigningOut) {
          // Explicit sign-out — full cleanup
          isSigningOut = false;
          localStorage.removeItem("google_access_token");
          localStorage.removeItem("google_refresh_token");
          localStorage.removeItem("cached_user");
          localStorage.removeItem("cached_household_id");
          localStorage.removeItem("cached_invite_code");
          set({ user: null, householdId: null, inviteCode: null, accessToken: null });
        } else {
          // Session expired automatically — try to recover before logging out
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
  },

  signOut: async () => {
    isSigningOut = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    const supabase = createClient();
    await supabase.auth.signOut();
    // State is cleared by the SIGNED_OUT handler above
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
