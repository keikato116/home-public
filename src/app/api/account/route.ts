import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// アカウント削除（App Store Guideline 5.1.1(v) の必須要件）。
//
// 世帯に自分しかいなければ、世帯ごと消す（households の on delete cascade で
// やること・買い物・レシピ・献立などがまとめて消える）。
//
// パートナーが残る場合、レシピだけは引き継ぐかどうかを選べる。
// レシピは部屋（ペアの期間）をまたいで残る唯一の共有データなので、
// 明示的に消せないと「別れた相手に自分のレシピが残り続ける」ことになる。
//
// 割り勘と共有の買い物リストは選択の対象にしていない。
// 相手は1人に戻り、部屋が変わった時点で表示されなくなるため
// （supabase/migrations/2026-09-11_pairing_scope.sql）。
//
// 自分の個人データ（非公開の買い物アイテム等）は、指定によらず
// auth.users の削除に張り直した外部キー経由で必ず消える
// （supabase/migrations/2026-09-11_account_deletion.sql）。

async function parseHandOverRecipes(req: NextRequest): Promise<boolean> {
  try {
    const body = await req.json();
    // 指定が無ければ「引き継ぐ」に倒す。消すほうを既定にすると、
    // 通信の食い違いでデータが消える事故が起きる。
    return body?.handOver?.recipes !== false;
  } catch {
    return true;
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
  }

  const handOverRecipes = await parseHandOverRecipes(req);

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
    } else {
      if (!handOverRecipes) {
        // 献立がレシピを参照しているので、先に参照を外してから消す。
        // 外部キーの on delete 指定に関係なく安全にするため。
        const { error: planError } = await admin
          .from("meal_plans")
          .update({ recipe_id: null })
          .eq("household_id", householdId)
          .not("recipe_id", "is", null);
        if (planError) {
          return NextResponse.json({ error: planError.message }, { status: 500 });
        }
        // レシピは owner_id の on delete cascade で消えるため、ここでは触らない
        const { error } = await admin.from("recipes").delete().eq("owner_id", user.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
