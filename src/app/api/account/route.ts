import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// アカウント削除（App Store Guideline 5.1.1(v) の必須要件）。
//
// 世帯に自分しかいなければ、世帯ごと消す（households の on delete cascade で
// やること・買い物・レシピ・献立などがまとめて消える）。
//
// パートナーが残る場合も、本人が登録したレシピと写真は必ず消す
// （recipes.owner_id の on delete cascade。写真はここでストレージから消す）。
// 相手に引き継ぐ選択肢は置かない。退会したら本人のデータは残さない、で統一している。
// 献立からの参照は meal_plans.recipe_id の on delete set null で外れる。
//
// 割り勘と共有の買い物リストは消さない。
// 相手は1人に戻り、部屋が変わった時点で表示されなくなるため
// （supabase/migrations/2026-09-11_pairing_scope.sql）。
//
// 自分の個人データ（非公開の買い物アイテム等）は、指定によらず
// auth.users の削除に張り直した外部キー経由で必ず消える
// （supabase/migrations/2026-09-11_account_deletion.sql）。

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** 公開 URL からバケット内のパスを取り出す */
function storagePath(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(/\/object\/public\/recipes\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * その人のレシピ写真をストレージから消す。
 *   - いまの置き場所: {user_id}/ の下（フォルダごと一覧して消す）
 *   - 以前の置き場所: {household_id}/ の下。レシピの行に残っている URL から拾う
 */
async function deletePhotosOf(admin: Admin, userId: string): Promise<string | null> {
  const paths = new Set<string>();

  const { data: recipes, error: rErr } = await admin
    .from("recipes")
    .select("thumbnail_url, photo_urls")
    .eq("owner_id", userId);
  if (rErr) return rErr.message;
  for (const r of recipes ?? []) {
    const p = storagePath(r.thumbnail_url);
    if (p) paths.add(p);
    for (const u of (r.photo_urls as string[] | null) ?? []) {
      const q = storagePath(u);
      if (q) paths.add(q);
    }
  }

  for (let offset = 0; ; offset += 1000) {
    const { data: files, error } = await admin.storage
      .from("recipes")
      .list(userId, { limit: 1000, offset });
    if (error) return error.message;
    for (const f of files ?? []) paths.add(`${userId}/${f.name}`);
    if (!files || files.length < 1000) break;
  }

  const all = Array.from(paths);
  for (let i = 0; i < all.length; i += 100) {
    const { error } = await admin.storage.from("recipes").remove(all.slice(i, i + 100));
    if (error) return error.message;
  }
  return null;
}

export async function DELETE() {
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

  if (membership?.household_id) {
    const householdId = membership.household_id as string;

    const { data: members } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId);

    const others = (members ?? []).filter((m) => m.user_id !== user.id);

    if (others.length === 0) {
      // 最後の1人。世帯を消せば紐づくデータは cascade で消える。
      const { error } = await admin.from("households").delete().eq("id", householdId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // レシピの写真を消す。レシピの行は owner_id の on delete cascade で消えるが、
  // ストレージのファイルは残り、公開 URL で見られたままになる。
  const photoError = await deletePhotosOf(admin, user.id);
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
