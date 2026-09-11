import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// アカウント削除（App Store Guideline 5.1.1(v) の必須要件）。
//
// 世帯に自分しかいなければ、世帯ごと消す（households の on delete cascade で
// やること・買い物・レシピ・献立などがまとめて消える）。
//
// パートナーが残っている場合は世帯そのものは残るので、2人で貯めてきた
// 共有データを相手に引き継ぐかどうかを選べる。引き継がない指定をしたものは
// ここで消す。共有データには作成者の記録が無い（shopping_items も split 系も
// 世帯単位）ので、カテゴリ単位で全部残すか全部消すかの二択になる。
//
// 自分の個人データ（非公開の買い物アイテム等）は、指定によらず
// auth.users の削除に張り直した外部キー経由で必ず消える
// （supabase/migrations/2026-09-11_account_deletion.sql）。

type HandOver = { recipes: boolean; split: boolean; shopping: boolean };

const HAND_OVER_ALL: HandOver = { recipes: true, split: true, shopping: true };

async function parseHandOver(req: NextRequest): Promise<HandOver> {
  try {
    const body = await req.json();
    const h = body?.handOver;
    if (!h) return HAND_OVER_ALL;
    // 指定が無いものは「引き継ぐ」に倒す。消すほうを既定にすると、
    // 通信の食い違いでデータが消える事故が起きる。
    return {
      recipes: h.recipes !== false,
      split: h.split !== false,
      shopping: h.shopping !== false,
    };
  } catch {
    return HAND_OVER_ALL;
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

  const handOver = await parseHandOver(req);

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
      if (!handOver.recipes) {
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
        const { error } = await admin.from("recipes").delete().eq("household_id", householdId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      if (!handOver.split) {
        for (const table of ["split_sessions", "split_subscriptions", "family_card_totals"]) {
          const { error } = await admin.from(table).delete().eq("household_id", householdId);
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
        }
      }

      if (!handOver.shopping) {
        // 共有アイテムだけ。非公開アイテムは user 削除で必ず消えるので触らない。
        const { error } = await admin
          .from("shopping_items")
          .delete()
          .eq("household_id", householdId)
          .is("user_id", null);
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
