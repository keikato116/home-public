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
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const token = session.provider_token ?? sessionStorage.getItem("google_access_token");
      if (session.provider_token) {
        sessionStorage.setItem("google_access_token", session.provider_token);
      }

      const { data: member } = await supabase
        .from("household_members")
        .select("household_id, households(invite_code)")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const hid = member?.household_id ?? null;
      const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

      set({
        user: session.user,
        householdId: hid,
        inviteCode: ic,
        accessToken: token,
        loading: false,
      });
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (session.provider_token) {
          sessionStorage.setItem("google_access_token", session.provider_token);
        }
        const token = session.provider_token ?? sessionStorage.getItem("google_access_token");

        const { data: member } = await supabase
          .from("household_members")
          .select("household_id, households(invite_code)")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const hid = member?.household_id ?? null;
        const ic = (member?.households as { invite_code?: string } | null)?.invite_code ?? null;

        set({ user: session.user, householdId: hid, inviteCode: ic, accessToken: token });
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("google_access_token");
        set({ user: null, householdId: null, inviteCode: null, accessToken: null });
      }
    });
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    get().init();
  },
}));
