import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// アカウント削除（App Store Guideline 5.1.1(v) の必須要件）。
//
// 世帯に自分しかいなければ、世帯ごと消す（households の on delete cascade で
// やること・買い物・レシピ・献立などがまとめて消える）。
// パートナーが残っている場合は、世帯そのものは残し、自分だけ抜ける。
// 自分の個人データ（非公開の買い物アイテム、個人ルーティン等）は
// auth.users の削除に張り直した外部キー経由で消える
// （supabase/migrations/2026-09-11_account_deletion.sql）。

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
    const { data: members } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", membership.household_id);

    const others = (members ?? []).filter((m) => m.user_id !== user.id);

    if (others.length === 0) {
      // 最後の1人。世帯を消せば紐づくデータは cascade で消える。
      const { error } = await admin.from("households").delete().eq("id", membership.household_id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    // パートナーが残る場合、household_members の行は auth.users 削除で cascade する。
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
