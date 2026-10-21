// レシピ取り込みの上限（supabase/migrations/2026-10-21_recipe_import_limit.sql）。
// 日本時間の毎月1日にリセット。

/** 利用者に見せる上限。取り込んで保存した品数で数える。 */
export const RECIPE_IMPORT_DISH_LIMIT = 30;

/**
 * Claude に読ませる回数の上限（写真1枚・URL 1件で1回）。利用者には見せない、費用の安全装置。
 * 写真数枚で1品のレシピや、読み直しがあっても 30品に届くよう余裕を持たせてある。
 */
export const RECIPE_ANALYSIS_LIMIT = 100;
