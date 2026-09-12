import type { SupabaseClient } from "@supabase/supabase-js";

// 世帯をまたいでデータを移すときの共通処理。
// 解散（/api/household/dissolve）と参加（/api/household/join）の両方が使う。
//
// 移し方は2種類ある。
//   複製 : レシピ・家事ルーティン・やること・献立
//          暮らしの土台なので、どちらの世帯にも同じものが残るようにする
//   移動 : 本人にしか見えない買い物アイテム
//          置いていくと本人からも見えなくなるので、行ごと持っていく
//
// 割り勘と共有の買い物リストは動かさない。相手との記録なので、
// 部屋（pairing_started_at）が変わった時点で表示もされなくなる。

type Row = Record<string, unknown>;

/**
 * 行を複製する。id は呼び出し側で振り直す。
 * DB 任せにすると元の行と新しい行の対応が取れず、
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

/**
 * from の世帯から to の世帯へ、userId の人が持っていくものを移す。
 *
 * 他人が作った行の created_by / user_id は null に落とす。
 * 移った先にいない人のIDを持ち込むと、名前が引けない幽霊の作成者になる。
 *
 * 失敗したらエラーメッセージを返す。成功なら null。
 */
export async function transferHouseholdData(
  admin: SupabaseClient,
  fromHouseholdId: string,
  toHouseholdId: string,
  userId: string
): Promise<string | null> {
  // 自分にしか見えない買い物アイテムは移動（複製ではない）
  const { error: moveError } = await admin
    .from("shopping_items")
    .update({ household_id: toHouseholdId })
    .eq("household_id", fromHouseholdId)
    .eq("user_id", userId);
  if (moveError) return moveError.message;

  const { data: recipes } = await admin.from("recipes").select("*").eq("household_id", fromHouseholdId);
  const recipeCopy = copyRows((recipes ?? []) as Row[], toHouseholdId);
  if (recipeCopy.rows.length > 0) {
    const rows = recipeCopy.rows.map((r) => ({
      ...r,
      created_by: r.created_by === userId ? userId : null,
    }));
    const { error } = await admin.from("recipes").insert(rows);
    if (error) return error.message;
  }

  const { data: routines } = await admin
    .from("routine_definitions").select("*").eq("household_id", fromHouseholdId);
  const routineCopy = copyRows((routines ?? []) as Row[], toHouseholdId);
  if (routineCopy.rows.length > 0) {
    const rows = routineCopy.rows.map((r) => ({
      ...r,
      user_id: r.user_id === userId ? userId : null,
    }));
    const { error } = await admin.from("routine_definitions").insert(rows);
    if (error) return error.message;
  }

  const { data: todos } = await admin
    .from("shared_todos").select("*").eq("household_id", fromHouseholdId);
  const todoCopy = copyRows((todos ?? []) as Row[], toHouseholdId);
  if (todoCopy.rows.length > 0) {
    const rows = todoCopy.rows.map((r) => ({
      ...r,
      created_by: r.created_by === userId ? userId : null,
    }));
    const { error } = await admin.from("shared_todos").insert(rows);
    if (error) return error.message;
  }

  const { data: plans } = await admin
    .from("meal_plans").select("*").eq("household_id", fromHouseholdId);
  const planCopy = copyRows((plans ?? []) as Row[], toHouseholdId);
  if (planCopy.rows.length > 0) {
    // 献立が指しているレシピを、複製したレシピのほうに向け直す
    const rows = planCopy.rows.map((r) => ({
      ...r,
      recipe_id: r.recipe_id ? recipeCopy.idMap.get(r.recipe_id as string) ?? null : null,
    }));
    const { error } = await admin.from("meal_plans").insert(rows);
    if (error) return error.message;
  }

  return null;
}
