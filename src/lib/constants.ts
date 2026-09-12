// localStorage keys
export const LS_GOOGLE_TOKEN = "google_access_token";
export const LS_GOOGLE_TOKEN_EXPIRY = "google_access_token_expires_at";
export const LS_GOOGLE_REFRESH = "google_refresh_token";
export const LS_CACHED_USER = "cached_user";
export const LS_CACHED_HOUSEHOLD = "cached_household_id";
export const LS_CACHED_INVITE = "cached_invite_code";
export const LS_CACHED_IS_OWNER = "cached_is_owner";
export const LS_GACHA_HISTORY = "gacha_history";
export const LS_SPLIT_CLOSING_DAY = "split_closing_day";
export const LS_SPLIT_RATIO = "split_ratio";
export const LS_CAL_CACHE_PREFIX = "cal_cache_";
export const LS_ENTITLED_CACHE = "entitled";
export const LS_CACHED_MEMBER_COUNT = "cached_member_count";

// OAuth
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

// 課金
// 課金機能そのものを出すかどうか。NEXT_PUBLIC_BILLING_ENABLED=true のときだけ有効。
//
// 初回リリースは課金なしで出す。そのとき購入ボタンを残すと、押しても何も買えない
// 状態になり Guideline 2.1（機能しないUI）で差し戻される。フラグが false の間は
// 設定の premium 欄もペイウォールも描画せず、RevenueCat の初期化も行わない。
//
// レシピと献立のタブは household_entitled() が false のまま＝全員に出ない。
// 課金を実装するときは、このフラグを true にして再デプロイする。
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

// RevenueCat ダッシュボードで作る Entitlement の識別子。ここを変えるなら向こうも変える。
export const RC_ENTITLEMENT_ID = "premium";
// 課金しないと使えないタブ。BottomTabBar と page.tsx の両方がこれを見る。
export const PREMIUM_TABS = ["cook", "recipe"] as const;
// 1人世帯では成立しないタブ（割り勘は him/her の2人前提）。
export const PAIR_ONLY_TABS = ["split"] as const;
// 審査・サポート用の公開ページ。App Store Connect には
// https://<デプロイ先>/terms · /privacy という絶対URLで登録する。
export const TERMS_URL = "/terms";
export const PRIVACY_URL = "/privacy";
// iOS のサブスク管理画面（解約はここからしかできない、と案内する必要がある）
export const MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";
