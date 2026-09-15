"use client";

import { create } from "zustand";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient, setJwt } from "@/lib/supabase/client";
import {
  LS_GOOGLE_TOKEN, LS_GOOGLE_TOKEN_EXPIRY, LS_GOOGLE_REFRESH,
  LS_CACHED_USER, LS_CACHED_HOUSEHOLD, LS_CACHED_INVITE, LS_CACHED_IS_OWNER,
  LS_ENTITLED_CACHE, LS_CACHED_MEMBER_COUNT,
} from "@/lib/constants";
import { logOutPurchases } from "@/lib/purchases";
import { normalizeDisplayName } from "@/lib/displayName";
import { storeAccessToken, upsertUserToken, refreshAccessToken, ensureValidAccessToken, connectGoogleCalendar } from "@/lib/googleToken";

export interface HouseholdMember {
  userId: string;
  displayName: string;
}

/**
 * 世帯のメンバーを、参加順（= 先頭が世帯を作った人）で返す。
 * 表示名は member_profiles にある。トークンとは別の表に置いてあるのは、
 * 同居人に見せてよい情報と見せてはいけない情報を混ぜないため。
 */
async function fetchMembers(
  supabase: ReturnType<typeof createClient>,
  householdId: string
): Promise<HouseholdMember[]> {
  const { data } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  const ids = (data ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [];

  const { data: tokens } = await supabase
    .from("member_profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  const nameById = new Map((tokens ?? []).map((t) => [t.user_id as string, t.display_name as string]));

  return ids.map((id) => ({ userId: id, displayName: nameById.get(id) ?? "" }));
}

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
  members: HouseholdMember[];
  /** null = 未取得。ソロ判定はこれが 1 以下かどうかで行う。 */
  memberCount: number | null;
  /**
   * 自分の表示名。null = まだ読めていない、"" = 未設定（名前を尋ねる）。
   * この2つを分けないと、読み込み中に入力画面が一瞬出てしまう。
   */
  displayName: string | null;
  loadDisplayName: () => Promise<void>;
  saveDisplayName: (raw: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  householdId: null,
  inviteCode: null,
  accessToken: null,
  loading: true,
  settingsOpen: false,
  activeTab: "home",
  calendarViewSignal: 0,
  isOwner: false,
  members: [],
  memberCount: null,
  displayName: null,

  loadDisplayName: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("member_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      // 行が無い（Apple だけで入った人）も、空文字（未入力）も、等しく未設定。
      set({ displayName: (data?.display_name as string | undefined) ?? "" });
    } catch {
      // 読めなかったときは null のままにして入力画面を出さない。
      // 通信が不安定なだけで名前を聞かれるのは鬱陶しい。
    }
  },

  saveDisplayName: async (raw) => {
    const { user, householdId } = get();
    if (!user) return;
    const name = normalizeDisplayName(raw);
    const supabase = createClient();
    await supabase.from("member_profiles").upsert({
      user_id: user.id,
      ...(householdId ? { household_id: householdId } : {}),
      display_name: name ?? "",
      updated_at: new Date().toISOString(),
    });
    set({ displayName: name ?? "" });
    await get().refreshMembers();
  },

  refreshMembers: async () => {
    const { householdId, user } = useAuthStore.getState();
    if (!householdId) return;
    const members = await fetchMembers(createClient(), householdId);
    localStorage.setItem(LS_CACHED_MEMBER_COUNT, String(members.length));
    set({
      members,
      memberCount: members.length,
      isOwner: members[0]?.userId === user?.id,
    });
  },

  setHouseholdId: (id, inviteCode) => {
    set({ householdId: id, inviteCode: inviteCode ?? null });
    // 世帯が決まった時点で Google のトークンを保存し直す。
    //
    // ログインは世帯に入る前に済んでいるので、そのときの upsertUserToken は
    // householdId がまだ無く飛ばされている。ここで書かないと user_tokens に
    // トークンが入らないままになり、**相手からこの人のカレンダーが永久に見えない**
    // （/api/partner-calendar は household_id で相手の行を引き、トークンが
    // 無ければ黙って空を返す）。新規ユーザーは全員この順序を通る。
    const token = get().accessToken ?? localStorage.getItem(LS_GOOGLE_TOKEN);
    const user = get().user;
    if (user && token) {
      void upsertUserToken(token).catch(() => {});
    }
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  bumpCalendarView: () => set((s) => ({ calendarViewSignal: s.calendarViewSignal + 1 })),

  init: async () => {
    const supabase = createClient();

    const cachedUser = localStorage.getItem(LS_CACHED_USER);
    const cachedHouseholdId = localStorage.getItem(LS_CACHED_HOUSEHOLD);
    const cachedInviteCode = localStorage.getItem(LS_CACHED_INVITE);
    const cachedIsOwner = localStorage.getItem(LS_CACHED_IS_OWNER) === "true";
    const cachedMemberCountRaw = localStorage.getItem(LS_CACHED_MEMBER_COUNT);
    const cachedMemberCount = cachedMemberCountRaw ? Number(cachedMemberCountRaw) : null;

    try {
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        set({
          user: parsedUser,
          householdId: cachedHouseholdId,
          inviteCode: cachedInviteCode,
          accessToken: localStorage.getItem(LS_GOOGLE_TOKEN),
          isOwner: cachedIsOwner,
          memberCount: cachedMemberCount,
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

        const [{ data: member }, tokenRow] = await Promise.all([
          supabase
            .from("household_members")
            .select("household_id, households(invite_code)")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          // localStorage が消えたときの復旧。表を直接読むと暗号文が返るので
          // /api/tokens を通す（復号できるのはサーバーだけ）。
          !localStorage.getItem(LS_GOOGLE_REFRESH)
            ? fetch("/api/tokens")
                .then((r) => (r.ok ? r.json() : { refreshToken: null }))
                .catch(() => ({ refreshToken: null }))
            : Promise.resolve({ refreshToken: null }),
        ]);

        if (tokenRow?.refreshToken && !localStorage.getItem(LS_GOOGLE_REFRESH)) {
          localStorage.setItem(LS_GOOGLE_REFRESH, tokenRow.refreshToken);
        }

        const hid = member?.household_id ?? null;

        // 埋め込みの households は、PostgREST の関連の見え方によって
        // オブジェクトでも配列でも返りうる。どちらでも拾えるようにしておく。
        const embedded = member?.households as
          | { invite_code?: string }
          | { invite_code?: string }[]
          | null
          | undefined;
        let ic =
          (Array.isArray(embedded) ? embedded[0]?.invite_code : embedded?.invite_code) ?? null;

        // それでも取れなければ直接引く。招待コードが無いと相手を呼べず、
        // 1人から2人になる道が塞がるので、ここは落とせない。
        if (hid && !ic) {
          const { data: household } = await supabase
            .from("households")
            .select("invite_code")
            .eq("id", hid)
            .maybeSingle();
          ic = (household?.invite_code as string | undefined) ?? null;
        }

        const members = hid ? await fetchMembers(supabase, hid) : [];
        const isOwner = members[0]?.userId === session.user.id;

        localStorage.setItem(LS_CACHED_USER, JSON.stringify(session.user));
        localStorage.setItem(LS_CACHED_HOUSEHOLD, hid ?? "");
        localStorage.setItem(LS_CACHED_INVITE, ic ?? "");
        localStorage.setItem(LS_CACHED_IS_OWNER, String(isOwner));
        localStorage.setItem(LS_CACHED_MEMBER_COUNT, String(members.length));

        set({
          user: session.user, householdId: hid, inviteCode: ic, accessToken: token,
          isOwner, members, memberCount: hid ? members.length : null, loading: false,
        });

        if (hid && token) {
          await upsertUserToken(token);
        }
        if (hid) await get().loadDisplayName();
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
          await upsertUserToken(token);
        }
        if (hid) await get().loadDisplayName();
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
          // 課金判定のキャッシュは持ち越さない。別アカウントでログインした人に
          // 前の人の権利が一瞬見えてしまう。
          localStorage.removeItem(LS_ENTITLED_CACHE);
          localStorage.removeItem(LS_CACHED_MEMBER_COUNT);
          set({
            user: null, householdId: null, inviteCode: null, accessToken: null,
            isOwner: false, members: [], memberCount: null,
          });
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
    await logOutPurchases();
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  reAuthGoogle: async () => {
    // Apple で登録した人が押しても、別アカウントに化けずに今のアカウントへ紐付く
    await connectGoogleCalendar(createClient());
  },
}));

// Re-exported for existing consumers (calendarStore)
export { ensureValidAccessToken } from "@/lib/googleToken";
