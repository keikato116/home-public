import type { SupabaseClient } from "@supabase/supabase-js";
import { transferHouseholdData } from "@/lib/server/householdTransfer";
import { resumeRoomIfReturning, billingBlocksJoin } from "@/lib/server/lapseExit";
import { BILLING_ENABLED } from "@/lib/constants";

// 世帯への参加（承認制）。
//
// 招待コードを入れても、すぐには入らない。参加の申請（join_requests）を作り、
// 世帯にいる人が承認したときに初めて入る。招待コードは、だれかが入った・抜けたたびに
// 作り直す（rotate_invite_code）。課金切れで抜けた人は、コードではなく
// アカウントで見分けて「前の部屋に戻る申請」を出せる（room_pauses）。
// supabase/migrations/2026-11-17_join_requests.sql
//
// 表はすべて service role で触る。呼ぶ側で本人確認を済ませること。

type Admin = SupabaseClient;

/** 申請は7日で無効にする。放っておかれた申請が、ずっと後に承認されないように。 */
export const JOIN_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** コードを試せる回数（1時間あたり）。総当たりで世帯を探されないように。 */
export const JOIN_ATTEMPT_LIMIT = 10;
const JOIN_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export class JoinError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** 招待コードを作り直して返す。 */
export async function rotateInviteCode(admin: Admin, householdId: string): Promise<string> {
  const { data, error } = await admin.rpc("rotate_invite_code", { p_household: householdId });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * コードを試した記録を残し、上限を超えていたら JoinError(429) を投げる。
 * 古い記録はここで消す。
 */
export async function recordJoinAttempt(admin: Admin, userId: string): Promise<void> {
  const since = new Date(Date.now() - JOIN_ATTEMPT_WINDOW_MS).toISOString();
  await admin.from("join_attempts").delete().eq("user_id", userId).lt("attempted_at", since);

  const { count, error } = await admin
    .from("join_attempts")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", since);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= JOIN_ATTEMPT_LIMIT) throw new JoinError(429, "too many attempts");

  const { error: insErr } = await admin.from("join_attempts").insert({ user_id: userId });
  if (insErr) throw new Error(insErr.message);
}

export async function membershipOf(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.household_id as string | undefined) ?? null;
}

export async function memberIdsOf(admin: Admin, householdId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => m.user_id as string);
}

/**
 * 申請を出せるか確かめる。だめなら JoinError を投げる。
 * 承認のときにも同じことを確かめ直す（申請から承認までに状況が変わりうる）。
 */
export async function assertCanJoin(admin: Admin, targetId: string, userId: string): Promise<void> {
  const targetMembers = await memberIdsOf(admin, targetId);
  // 2人で満員。3人は想定していない（割り勘が him / her の2人前提）。
  // 「無い」と「満員」で返事を変えると、存在するコードを見分ける手がかりになるので同じにする。
  if (targetMembers.length === 0 || targetMembers.length >= 2) {
    throw new JoinError(404, "invite code not found");
  }

  const currentId = await membershipOf(admin, userId);
  if (currentId) {
    const currentMembers = await memberIdsOf(admin, currentId);
    // すでに誰かと使っている世帯からは移れない。先に解散してもらう。
    if (currentMembers.length >= 2) throw new JoinError(409, "leave your current household first");
  }

  // 2人とも権利が要る（課金をオンにしている間だけ）。
  if (BILLING_ENABLED) {
    const block = await billingBlocksJoin(admin, targetId, userId);
    if (block) throw new JoinError(block === "subscription required" ? 402 : 409, block);
  }
}

/**
 * userId を targetId の世帯に入れる（承認されたときに呼ぶ）。
 *   ・まだ世帯が無い人 → そのまま入る
 *   ・1人で使っている人 → いまの世帯を畳んで移る（レシピ・家事・やること・献立は複製して持っていく）
 * 入ったら、課金切れで抜けた人の再開を処理し、招待コードを作り直す。
 * 移ったら true。
 */
export async function addMemberToHousehold(admin: Admin, targetId: string, userId: string): Promise<boolean> {
  const currentId = await membershipOf(admin, userId);
  if (currentId === targetId) return false;

  const now = () => new Date().toISOString();
  const pointTo = async (householdId: string) => {
    // Google の鍵と表示名も同じ世帯を指していないと、相手の予定と名前が出ない。
    await admin.from("user_tokens").update({ household_id: householdId, updated_at: now() }).eq("user_id", userId);
    await admin.from("member_profiles").update({ household_id: householdId, updated_at: now() }).eq("user_id", userId);
  };

  let moved = false;
  if (!currentId) {
    const { error } = await admin.from("household_members").insert({ household_id: targetId, user_id: userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    await pointTo(targetId);
  } else {
    // 先に複製する。移ってから失敗すると、古い世帯に戻る手段が無くなる。
    const copyError = await transferHouseholdData(admin, currentId, targetId, userId);
    if (copyError) throw new Error(copyError);

    // 「抜けてから入る」順で。逆にすると一瞬2世帯に所属し、所属を maybeSingle() で
    // 引いている箇所が複数行エラーになる。
    const { error: leaveError } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", currentId)
      .eq("user_id", userId);
    if (leaveError) throw new Error(leaveError.message);

    const { error: joinError } = await admin.from("household_members").insert({ household_id: targetId, user_id: userId });
    if (joinError) throw new Error(joinError.message);
    await pointTo(targetId);

    // 空になった元の世帯を消す。持っていくものは上で複製済み。
    await admin.from("households").delete().eq("id", currentId);
    moved = true;
  }

  // 課金切れで抜けた人が戻ってきたなら元の部屋を再開する。別の人なら再開の控えを捨てる。
  await resumeRoomIfReturning(admin, targetId, userId);
  // 満員になったので、この世帯への残りの申請は消す。使ったコードも作り直す。
  await admin.from("join_requests").delete().eq("household_id", targetId);
  await rotateInviteCode(admin, targetId);
  return moved;
}
