"use client";

import { create } from "zustand";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient, setJwt } from "@/lib/supabase/client";
import {
  LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
  LS_CACHED_USER, LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER,
} from "@/lib/constants";
import {
  storeAccessToken, upsertUserToken, refreshAccessToken,
  ensureValidAccessToken, startGoogleOAuth,
} from "@/lib/googleToken";

interface AuthState {
  user: User | null;
  householdId: string | null;
  inviteCode: string | null;
  accessToken: string | null;
  loading: boolean;
  settingsOpen: boolean;
  activeTab: string;
  calendarViewSignal: number;
  isOwner: boolean;
  setHouseholdId: (id: string, inviteCode?: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  bumpCalendarView: () => void;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
  reAuthGoogle: () => Promise<void>;
}

let isSigningOut = false;
let periodicRefreshInterval: ReturnType<typeof setInterval> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  householdId: null,
  inviteCode: null,
  accessToken: null,
  loading: true,
  settingsOpen: false,
  activeTab: "home",
  calendarViewSignal: 0,
  isOwner: false,

  setHouseholdId: (id, inviteCode) => set({ householdId: id, inviteCode: inviteCode ?? null }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  bumpCalendarView: () => set((s) => ({ calendarViewSignal: s.calendarViewSignal + 1 })),

  init: async () => {
    const supabase = createClient();

    const cachedUser = localStorage.getItem(LS_CACHED_USER);
    const cachedHouseholdId = localStorage.getItem(LS_CACHED_HOUSEHOLD);
    const cachedInviteCode = localStorage.getItem(LS_CACHED_INVITE);
    const cachedIsOwner = localStorage.getItem(LS_CACHED_IS_OWNER) === "true";

    try {
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        set({
          user: parsedUser,
          householdId: cachedHouseholdId,
          inviteCode: cachedInviteCode,
          accessToken: localStorage.getItem(LS_GOOGLE_TOKEN),
          isOwner: cachedIsOwner,
          loading: false,
        });
        // Proactively refresh in the background so the cached token is fresh
        refreshAccessToken().catch(() => {});
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (session.access_token) setJwt(session.access_token);
        if (session.provider_token) {
          storeAccessToken(session.provider_token);
        }
        if (session.provider_refresh_token) {
          localStorage.setItem(LS_GOOGLE_REFRESH, session.provider_refresh_token);
        }
        const token = session.provider_token ?? localStorage.getItem(LS_GOOGLE_TOKEN);

        const [{ data: member }, { data: tokenRow }] = await Promise.all([
          supabase
            .from("household_members")
            .select("household_id, households(invite_code)")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          !localStorage.getItem(LS_GOOGLE_REFRESH)
            ? supabase
                .from("user_tokens")
                .select("google_refresh_token")
                .eq("user_id", session.user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (tokenRow?.google_refresh_token && !localStorage.getItem(LS_GOOGLE_REFRESH)) {
          localStorage.setItem(LS_GOOGLE_REFRESH, tokenRow.google_refresh_token);
        }

        const hid = member?.household_id ?? null;
        const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

        let isOwner = false;
        if (hid) {
          const { data: firstMember } = await supabase
            .from("household_members")
            .select("user_id")
            .eq("household_id", hid)
            .order("joined_at", { ascending: true })
            .limit(1)
            .single();
          isOwner = firstMember?.user_id === session.user.id;
        }

        localStorage.setItem(LS_CACHED_USER, JSON.stringify(session.user));
        localStorage.setItem(LS_CACHED_HOUSEHOLD, hid ?? "");
        localStorage.setItem(LS_CACHED_INVITE, ic ?? "");
        localStorage.setItem(LS_CACHED_IS_OWNER, String(isOwner));

        set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token, isOwner, loading: false });

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
      // Refresh Google token and Supabase JWT on foreground
      ensureValidAccessToken().catch(() => {});
      supabase.auth.refreshSession().catch(() => {});
    });

    supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_IN" && session) {
        if (session.access_token) setJwt(session.access_token);
        if (session.provider_token) {
          storeAccessToken(session.provider_token);
        }
        if (session.provider_refresh_token) {
          localStorage.setItem(LS_GOOGLE_REFRESH, session.provider_refresh_token);
        }
        const token = session.provider_token ?? localStorage.getItem(LS_GOOGLE_TOKEN);

        const { data: member } = await supabase
          .from("household_members")
          .select("household_id, households(invite_code)")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const hid = member?.household_id ?? null;
        const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

        localStorage.setItem(LS_CACHED_USER, JSON.stringify(session.user));
        localStorage.setItem(LS_CACHED_HOUSEHOLD, hid ?? "");
        localStorage.setItem(LS_CACHED_INVITE, ic ?? "");

        set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token });
        if (hid && token) {
          const displayName = session.user.user_metadata?.full_name ?? session.user.email ?? "";
          await upsertUserToken(supabase, session.user.id, hid, token, displayName);
        }
      } else if (event === "TOKEN_REFRESHED" && session) {
        if (session.access_token) setJwt(session.access_token);
        if (session.provider_token) {
          storeAccessToken(session.provider_token);
          set({ accessToken: session.provider_token });
        }
      } else if (event === "SIGNED_OUT") {
        if (isSigningOut) {
          isSigningOut = false;
          localStorage.removeItem(LS_GOOGLE_TOKEN);
          localStorage.removeItem(LS_GOOGLE_TOKEN_EXPIRY);
          localStorage.removeItem(LS_GOOGLE_REFRESH);
          localStorage.removeItem(LS_CACHED_USER);
          localStorage.removeItem(LS_CACHED_HOUSEHOLD);
          localStorage.removeItem(LS_CACHED_INVITE);
          localStorage.removeItem(LS_CACHED_IS_OWNER);
          set({ user: null, householdId: null, inviteCode: null, accessToken: null, isOwner: false });
        } else {
          const { data: { session: recovered } } = await supabase.auth.refreshSession();
          if (recovered) {
            if (recovered.access_token) setJwt(recovered.access_token);
            localStorage.setItem(LS_CACHED_USER, JSON.stringify(recovered.user));
            set({ user: recovered.user });
          } else {
            localStorage.removeItem(LS_CACHED_USER);
            localStorage.removeItem(LS_CACHED_HOUSEHOLD);
            localStorage.removeItem(LS_CACHED_INVITE);
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
    await startGoogleOAuth(createClient());
  },
}));

// Re-exported for existing consumers (calendarStore)
export { ensureValidAccessToken } from "@/lib/googleToken";
