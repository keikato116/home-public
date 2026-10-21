import type { SupabaseClient } from "@supabase/supabase-js";

// 相手の課金が切れたら解散する（利用規約「5. 有料プラン」、設定・購入画面に明記）。
//
// 解散といっても、データは世帯に残して、切れた人だけが自動で抜ける。
// 抜けた人が再び加入し、同じ招待コードで入り直すと、元の部屋が再開する
// （割り勘・共有の買い物リストなど、部屋で区切っている記録がまた見える）。
//
// RevenueCat の webhook が「期限切れ」を書いた直後に呼ぶ。EXPIRATION は Apple の
// 支払いリトライ（猶予期間）が終わってから届くので、一時的な支払い失敗では抜けない。
//
// 抜けるのは「切れた人に権利が残っておらず、相手はまだ権利を持っている」ときだけ。
//   - 相手も権利を持っていない（無料で使っているペア、2人とも解約した）→ 抜けない。
//     無料の機能（予定・家事・買い物・割り勘）を2人で使っている人を巻き込まないため
//   - 切れた人に運営の付与が残っている → 切れていないので抜けない
//
// 運営の付与（premium_grants）の期限切れでは抜けない。イベントが無く、
// 付与は運営が管理するものなので、必要なら運営が判断する。

/** 抜けるべきか。権利は member_premium_source() の値（null = 無し）。 */
export function shouldExitAfterLapse(
  lapsedUserRight: string | null,
  partnerRights: (string | null)[]
): boolean {
  if (lapsedUserRight !== null) return false;
  return partnerRights.some((r) => r !== null);
}

async function rightOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.rpc("member_premium_source", { p_user: userId });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

/** 抜けたら true。エラーは throw（webhook が 5xx を返して再送させる）。 */
export async function exitIfPartnerStillPaying(
  admin: SupabaseClient,
  lapsedUserId: string
): Promise<boolean> {
  const { data: membership, error: mErr } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", lapsedUserId)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!membership?.household_id) return false;
  const householdId = membership.household_id as string;

  const { data: members, error: listErr } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  if (listErr) throw new Error(listErr.message);
  const partners = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== lapsedUserId);
  if (partners.length === 0) return false;

  const own = await rightOf(admin, lapsedUserId);
  const partnerRights = await Promise.all(partners.map((id) => rightOf(admin, id)));
  if (!shouldExitAfterLapse(own, partnerRights)) return false;

  await leaveKeepingRoom(admin, householdId, lapsedUserId);
  return true;
}

/**
 * userId を世帯から抜き、空の1人用の世帯に移す。データは何も動かさない。
 *
 * 手動の解散（/api/household/dissolve）と違って、レシピ以外は持ち出さない。
 * 戻ってきたときに元の部屋がそのまま再開するのが目的なので、複製すると
 * 戻るときに（参加の処理で）もう一度持ち込まれて二重になる。
 * 自分だけの買い物アイテムも世帯に置いておく。抜けているあいだは本人にも
 * 見えないが、戻れば見える。レシピは持ち主が人なので、そのままついてくる。
 */
async function leaveKeepingRoom(
  admin: SupabaseClient,
  householdId: string,
  userId: string
): Promise<void> {
  // 抜けると pairing_started_at がトリガーで now() に変わるので、先に控える。
  const { data: room, error: roomErr } = await admin
    .from("households")
    .select("pairing_started_at")
    .eq("id", householdId)
    .single();
  if (roomErr || !room) throw new Error(roomErr?.message ?? "household not found");

  const { error: pauseErr } = await admin.from("room_pauses").upsert({
    household_id: householdId,
    user_id: userId,
    pairing_started_at: room.pairing_started_at,
    paused_at: new Date().toISOString(),
  });
  if (pauseErr) throw new Error(pauseErr.message);

  const { data: solo, error: createErr } = await admin
    .from("households")
    .insert({ name: "my home" })
    .select()
    .single();
  if (createErr || !solo) throw new Error(createErr?.message ?? "failed to create household");
  const soloId = solo.id as string;

  await admin.from("calendar_settings").insert({
    household_id: soloId,
    selected_colors: [],
    start_date: new Date().toISOString().split("T")[0],
  });

  // 「抜けてから入る」順で。逆にすると一瞬2世帯に所属し、所属を maybeSingle() で
  // 引いている箇所が複数行エラーになる。
  const { error: leaveErr } = await admin
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);
  if (leaveErr) throw new Error(leaveErr.message);

  const { error: joinErr } = await admin
    .from("household_members")
    .insert({ household_id: soloId, user_id: userId });
  if (joinErr) throw new Error(joinErr.message);

  // Google の鍵と表示名を新しい世帯に付け替える。これをしないと、残った側から
  // 抜けた人のカレンダーが見えたままになる。
  const now = new Date().toISOString();
  const { error: tokenErr } = await admin
    .from("user_tokens")
    .update({ household_id: soloId, updated_at: now })
    .eq("user_id", userId);
  if (tokenErr) throw new Error(tokenErr.message);
  await admin
    .from("member_profiles")
    .update({ household_id: soloId, updated_at: now })
    .eq("user_id", userId);
}

/**
 * 参加する前に呼ぶ（/api/household/join）。課金切れで抜けた人が、まだ加入し直して
 * いないのに同じ世帯へ戻ろうとしているなら true（= 断る）。
 *
 * 戻ってしまうと、払い続けている相手の有料機能まで閉じる（2人とも権利が要るため）。
 * 抜けた理由がそもそも「相手は払っているのに自分が切れた」なので、
 * 戻るには加入し直してもらう。相手ももう権利を持っていなければ、止める理由は無い。
 */
export async function mustResubscribeToReturn(
  admin: SupabaseClient,
  householdId: string,
  userId: string
): Promise<boolean> {
  const { data: pause, error } = await admin
    .from("room_pauses")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // マイグレーション（2026-10-21_room_pauses.sql）前なら控えは無い。参加を止めない。
    if (error.code === "42P01" || error.code === "PGRST205") return false;
    throw new Error(error.message);
  }
  if (!pause) return false;

  if ((await rightOf(admin, userId)) !== null) return false;

  const { data: members, error: listErr } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  if (listErr) throw new Error(listErr.message);
  const rights = await Promise.all((members ?? []).map((m) => rightOf(admin, m.user_id as string)));
  return rights.some((r) => r !== null);
}

/**
 * 参加した直後に呼ぶ（/api/household/join）。
 *
 * 課金切れで抜けた人が同じ世帯に戻ってきたなら、部屋の開始時刻を抜けた時点の
 * ものに戻して、前の記録を見えるようにする。
 * それ以外の人が入ったなら、その世帯の控えを捨てる。部屋が別物になったので、
 * あとで元の人が戻っても、その間の記録を見せてはいけない。
 */
export async function resumeRoomIfReturning(
  admin: SupabaseClient,
  householdId: string,
  userId: string
): Promise<void> {
  const { data: pause } = await admin
    .from("room_pauses")
    .select("pairing_started_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (pause) {
    const { error } = await admin
      .from("households")
      .update({ pairing_started_at: pause.pairing_started_at })
      .eq("id", householdId);
    if (error) throw new Error(error.message);
  }

  await admin.from("room_pauses").delete().eq("household_id", householdId);
}
