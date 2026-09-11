import { createClient } from "@supabase/supabase-js";

/**
 * service role キーを使う Supabase クライアント。RLS を無視できるので、
 * **必ずサーバー側だけ**で使う。呼ぶ前に呼び出し元の本人確認を済ませること。
 *
 * 使いどころは、RLS では表現できない操作:
 *   - RevenueCat webhook（そもそもログインユーザーがいない）
 *   - アカウント削除（auth.users を消す）
 *   - パートナーを世帯から外す（household_members に delete ポリシーがない）
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
