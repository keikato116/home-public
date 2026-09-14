import type { User } from "@supabase/supabase-js";

// 表示名。世帯の相手から見える名前で、予定の持ち主や家事の完了者として出る。
//
// 置き場所は user_tokens.display_name。名前が示すよりこの表は広く、
// user_id が主キーで全列に既定値があるので、Google を繋いでいない人の行も作れる。
// RLS は「本人が書ける・同居人が読める」で既に揃っている。
//
// **本人が入力した名前が正。** 以前は Google プロフィールの名前を
// トークン更新のたびに書き込んでいたが、それだと手で直した名前が消えるうえ、
// Apple だけで入った人は行すら作られず名無しのままだった。いまは
// upsertUserToken は名前に触らず、ここだけが書く。

/** 一覧や列見出しに収まる長さ。頭文字だけ使う場所もあるので短くてよい。 */
export const MAX_DISPLAY_NAME = 12;

/**
 * 入力を保存できる形に整える。
 * 前後の空白と連続する空白を潰し、長すぎるものを切る。
 * 空になったら null（＝未設定）を返す。
 */
export function normalizeDisplayName(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed === "") return null;
  return Array.from(collapsed).slice(0, MAX_DISPLAY_NAME).join("");
}

/**
 * 入力欄の初期値。ログインした方法から分かる名前を置いておく。
 * Apple は名前を渡さないことがあり、その場合は空のまま出す
 * （メールアドレスをそのまま名前として提案しない。相手に見える名前なので）。
 */
export function suggestDisplayName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const candidate =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    "";
  return normalizeDisplayName(candidate) ?? "";
}
