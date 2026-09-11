import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// グループの解散。招待した側・された側のどちらからでも実行できる。
//
// 押した人によらず、あとから参加した人が抜ける。共有していたデータ（2人で使っていた
// 買い物リスト・やること・レシピ・献立）は世帯を作った人に残る。結果が押した人に
// 依存しないので、「先に押したほうがデータを持っていく」早い者勝ちにならない。
//
// 抜ける人には新しい1人用の世帯をここで作り、暮らしの土台になるものを持たせる。
//   移す  : 自分にしか見えない買い物アイテム（置いていくと本人からも見えなくなる）
//   複製  : レシピ・家事ルーティン・やること・献立（2人で作ったものなので両方が持つ）
//   残す  : 割り勘・共有の買い物リスト（相手との記録。部屋が変わるので表示もされない）
//
// カレンダーが見えなくなるのは household_members を消すだけでは不十分。
// /api/partner-calendar は service role で user_tokens を household_id で引くので、
// 抜けた人の user_tokens を新しい世帯に付け替えて、古い世帯から引けないようにする。

type Row = Record<string, unknown>;

/**
 * 世帯のデータを、抜ける人の新しい世帯に複製する。
 *
 * id は呼び出し側で振り直す。DB 任せにすると、元の行と新しい行の対応が取れず
 * 献立からレシピへの参照を張り替えられない（複数行 insert の戻り順は保証がない）。
 */
function copyRows(rows: Row[], householdId: string): { rows: Row[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const copied = rows.map((r) => {
    const newId = crypto.randomUUID();
    idMap.set(r.id as string, newId);
    return { ...r, id: newId, household_id: householdId };
  });
  return { rows: copied, idMap };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership?.household_id) {
    return NextResponse.json({ error: "not in a household" }, { status: 400 });
  }
  const oldHouseholdId = membership.household_id as string;

  const { data: members } = await admin
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", oldHouseholdId)
    .order("joined_at", { ascending: true });

  const rows = members ?? [];
  if (rows.length <= 1) {
    return NextResponse.json({ error: "already solo" }, { status: 400 });
  }

  // 先頭 = 世帯を作った人。共有データはこの人に残る。
  const ownerId = rows[0].user_id as string;
  const leaving = rows.filter((m) => m.user_id !== ownerId).map((m) => m.user_id as string);

  for (const leaverId of leaving) {
    const { data: household, error: createError } = await admin
      .from("households")
      .insert({ name: "my home" })
      .select()
      .single();
    if (createError || !household) {
      return NextResponse.json({ error: createError?.message ?? "failed to create household" }, { status: 500 });
    }
    const newHouseholdId = household.id as string;

    await admin.from("calendar_settings").insert({
      household_id: newHouseholdId,
      selected_colors: [],
      start_date: new Date().toISOString().split("T")[0],
    });

    // 世帯の移動は「抜けてから入る」順で行う。逆にすると一瞬2世帯に所属し、
    // 所属世帯を maybeSingle() で引いている箇所が複数行エラーになる。
    const { error: leaveError } = await admin
      .from("household_members")
      .delete()
      .eq("household_id", oldHouseholdId)
      .eq("user_id", leaverId);
    if (leaveError) {
      return NextResponse.json({ error: leaveError.message }, { status: 500 });
    }

    const { error: joinError } = await admin
      .from("household_members")
      .insert({ household_id: newHouseholdId, user_id: leaverId });
    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 });
    }

    // 本人にしか見えない買い物アイテム（user_id が入っているもの）を持っていく。
    // 共有アイテム（user_id が null）は2人で使っていたものなので古い世帯に残す。
    const { error: moveError } = await admin
      .from("shopping_items")
      .update({ household_id: newHouseholdId })
      .eq("household_id", oldHouseholdId)
      .eq("user_id", leaverId);
    if (moveError) {
      return NextResponse.json({ error: moveError.message }, { status: 500 });
    }

    // --- 暮らしの土台になるものを複製する ---
    // 2人で作ったものなので、抜ける側にも残る側にも同じものが残る。

    const { data: recipes } = await admin.from("recipes").select("*").eq("household_id", oldHouseholdId);
    const recipeCopy = copyRows((recipes ?? []) as Row[], newHouseholdId);
    if (recipeCopy.rows.length > 0) {
      // 作成者は自分の分だけ残す。相手のIDを持ち出すと、抜けた先で
      // 名前が引けない幽霊の作成者になる。
      const rows = recipeCopy.rows.map((r) => ({
        ...r,
        created_by: r.created_by === leaverId ? leaverId : null,
      }));
      const { error } = await admin.from("recipes").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: routines } = await admin
      .from("routine_definitions").select("*").eq("household_id", oldHouseholdId);
    const routineCopy = copyRows((routines ?? []) as Row[], newHouseholdId);
    if (routineCopy.rows.length > 0) {
      // 担当も同様。相手が担当だった家事は担当なしに戻す。
      const rows = routineCopy.rows.map((r) => ({
        ...r,
        user_id: r.user_id === leaverId ? leaverId : null,
      }));
      const { error } = await admin.from("routine_definitions").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: todos } = await admin
      .from("shared_todos").select("*").eq("household_id", oldHouseholdId);
    const todoCopy = copyRows((todos ?? []) as Row[], newHouseholdId);
    if (todoCopy.rows.length > 0) {
      const rows = todoCopy.rows.map((r) => ({
        ...r,
        created_by: r.created_by === leaverId ? leaverId : null,
      }));
      const { error } = await admin.from("shared_todos").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: plans } = await admin
      .from("meal_plans").select("*").eq("household_id", oldHouseholdId);
    const planCopy = copyRows((plans ?? []) as Row[], newHouseholdId);
    if (planCopy.rows.length > 0) {
      // 献立が指しているレシピを、複製したレシピのほうに向け直す。
      const rows = planCopy.rows.map((r) => ({
        ...r,
        recipe_id: r.recipe_id ? recipeCopy.idMap.get(r.recipe_id as string) ?? null : null,
      }));
      const { error } = await admin.from("meal_plans").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Google の鍵を新しい世帯に付け替える。これをしないと、残った側からは
    // 抜けた人のカレンダーが見えたままになる。
    const { error: tokenError } = await admin
      .from("user_tokens")
      .update({ household_id: newHouseholdId, updated_at: new Date().toISOString() })
      .eq("user_id", leaverId);
    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, left: leaving.includes(user.id) });
}
