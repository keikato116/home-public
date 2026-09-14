"use client";

import { Capacitor } from "@capacitor/core";
import type { RoutineDefinition } from "@/types";
import { getTodaysRoutines } from "@/lib/routine";
import { getJSTToday } from "@/lib/dates";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_CHORE_NOTIFY } from "@/lib/constants";

// 「今日の家事」のローカル通知。
//
// サーバーからは送らない。端末が自分で予約して自分で鳴らすので、APNs の鍵も
// デバイストークンの管理も要らず、Vercel の cron（Hobby は1日1回・時刻は1時間の
// 幅でしか保証されない）にも縛られない。時刻は端末のタイムゾーンで正確に出る。
//
// ネイティブ限定のプラグインなので、purchases.ts と同じく動的 import にしている。
// ブラウザ（PWA / 開発時）では何もしない。

/** 通知の設定。端末ごとの設定なので localStorage に置く（世帯では共有しない）。 */
export interface ChoreNotifySetting {
  enabled: boolean;
}

export const DEFAULT_CHORE_NOTIFY: ChoreNotifySetting = {
  enabled: false,
};

// iOS はアプリごとに未発火のローカル通知を **64件** までしか保持しない。超えた分は
// 黙って捨てられる。DAYS_AHEAD × MAX_SLOTS_PER_DAY がこの 64 を超えないこと。
// いまは 7 × 6 = 42 で、22件の余裕がある。
// この不変条件は notifications.test.ts が見張っている。
export const IOS_PENDING_LIMIT = 64;

/** 予約しておく日数。アプリを開かなくてもこの日数ぶんは鳴り続ける。 */
export const DAYS_AHEAD = 7;

/** 1日に鳴らせる時刻の数の上限。これを超える時刻が設定されたぶんは早い順に切る。 */
export const MAX_SLOTS_PER_DAY = 6;

/** この機能が使う通知IDの範囲。他の用途と衝突しないよう先頭を決めておく。 */
const ID_BASE = 7100;
const ID_COUNT = DAYS_AHEAD * MAX_SLOTS_PER_DAY;

export function notificationsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export function getChoreNotifySetting(): ChoreNotifySetting {
  return getJSON<ChoreNotifySetting>(LS_CHORE_NOTIFY, DEFAULT_CHORE_NOTIFY);
}

export function saveChoreNotifySetting(s: ChoreNotifySetting): void {
  setJSON(LS_CHORE_NOTIFY, s);
}

async function plugin() {
  const mod = await import("@capacitor/local-notifications");
  return mod.LocalNotifications;
}

// プラグイン呼び出しが落ちたときの中身。catch で握り潰すと画面上は
// 「チェックが入らない」としか見えず、端末を手元に持っていない側からは
// 原因にたどり着けない。最後の失敗だけ覚えて設定画面に出す。
let lastError: string | null = null;

export function lastNotificationError(): string | null {
  return lastError;
}

/**
 * ネイティブ側にプラグインが登録されているか。JS 側の import が通っても、
 * アプリに実体が入っていなければ false になる。呼び出しが応答しないのか、
 * そもそも居ないのかを、待たずに1行で見分けられる。
 */
/**
 * ブリッジ全体が生きているかを、別のプラグインで確かめる。
 *
 * LocalNotifications が応答しないとき、原因は2通りある。
 *   - そのプラグインだけが壊れている
 *   - ネイティブへの呼び出し自体が片道で、どのプラグインも返事をしない
 * 見分けがつかないと直しようがないので、確実に入っている @capacitor/app に
 * 同じ形式の呼び出しを投げて比べる。
 */
export async function bridgeProbe(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "native=no";
  try {
    const { App } = await withTimeout(import("@capacitor/app"), CALL_TIMEOUT_MS, "App の読み込み");
    const info = await withTimeout(App.getInfo(), CALL_TIMEOUT_MS, "App.getInfo");
    return `bridge=ok (${info.id} ${info.version}/${info.build})`;
  } catch (e) {
    return `bridge=NG (${e instanceof Error ? e.message : String(e)})`;
  }
}

export function nativePluginPresent(): boolean {
  try {
    return Capacitor.isPluginAvailable("LocalNotifications");
  } catch {
    return false;
  }
}

function recordError(where: string, e: unknown): void {
  lastError = `${where}: ${e instanceof Error ? e.message : String(e)}`;
  console.warn("[notifications]", lastError, e);
}

/**
 * ネイティブ側が応答しないことがある。プラグインが登録されていても実体が
 * 無ければ、ブリッジに投げた呼び出しは失敗すらせず、ただ返ってこない。
 * そのまま await すると画面は「確認中…」のまま固まり、原因が何も分からない。
 * 待つのをやめて、returned しなかったという事実をエラーに変える。
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} が ${ms / 1000} 秒たっても応答しません`)),
      ms
    );
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// 許可のダイアログは利用者が答えるまで返らないので、そこだけ長く待つ。
// 残りは即座に返るはずのものなので、返らなければ異常。
const ANSWER_TIMEOUT_MS = 60_000;
const CALL_TIMEOUT_MS = 8_000;

/**
 * 通知の状態。"denied" と "unavailable" は画面上の見え方が同じ（チェックが入らない）
 * ぶん、区別できないと原因にたどり着けないので分けてある。
 *
 *   denied      … 利用者が断った。iOS は一度断られると二度と聞かないので、
 *                 設定アプリから手で許可してもらうしかない
 *   unavailable … プラグインのネイティブ側がアプリに入っていない。
 *                 `npx cap sync ios` してビルドし直すと直る。
 *                 この状態では iOS の設定にアプリの「通知」の行すら出ない
 *                 （OS に一度も許可を求めていないため）
 */
export type NotifyPermission = "granted" | "denied" | "unavailable";

/**
 * 通知の許可を求める。すでに許可済みなら何も出ない。
 * 起動時ではなく、設定で利用者がオンにしたときに呼ぶこと
 * （理由が分からないまま許可を求められると、まず拒否される）。
 */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!notificationsAvailable()) return "unavailable";
  try {
    const LocalNotifications = await withTimeout(plugin(), CALL_TIMEOUT_MS, "プラグインの読み込み");
    const res = await withTimeout(
      LocalNotifications.requestPermissions(), ANSWER_TIMEOUT_MS, "requestPermissions"
    );
    lastError = null;
    return res.display === "granted" ? "granted" : "denied";
  } catch (e) {
    // ブリッジは生きているのに呼び出しが落ちる＝ネイティブ側が登録されていない
    recordError("requestPermissions", e);
    return "unavailable";
  }
}

/** この機能が予約したぶんだけ取り消す。他の通知には触らない。 */
async function cancelOurs(): Promise<void> {
  const LocalNotifications = await withTimeout(plugin(), CALL_TIMEOUT_MS, "プラグインの読み込み");
  const pending = await withTimeout(
    LocalNotifications.getPending(), CALL_TIMEOUT_MS, "getPending"
  );
  const ours = pending.notifications.filter(
    (n) => n.id >= ID_BASE && n.id < ID_BASE + ID_COUNT
  );
  if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });
}

function bodyFor(labels: string[]): string {
  if (labels.length <= 3) return labels.join("、");
  return `${labels.slice(0, 3).join("、")} ほか${labels.length - 3}件`;
}

/** 予約する1件分。プラグインの schedule() にそのまま渡せる形。 */
export interface PlannedNotification {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
}

/**
 * "HH:MM" / "HH:MM:SS" を分数に直す。読めなければ null。
 * Postgres の time 型は "07:00:00" で返ってくる。
 */
export function parseNotifyAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 何をいつ鳴らすかを決める、副作用の無い部分。
 *
 * ここだけ切り出してあるのは、プラグインを起動せずにテストできるようにするため。
 * 実際の予約は syncChoreNotifications が行う。
 *
 * 時刻は家事ごとに持つ（朝やる家事と夜やる家事を分けるため）。
 * **時刻が設定されていない家事は通知しない。** 既定の時刻へのフォールバックは置かない。
 * 家事を追加しただけで勝手に通知が増えるほうが、鳴らないより困るため。
 * 同じ時刻の家事は1件の通知にまとめる。
 */
export function planChoreNotifications(
  definitions: RoutineDefinition[],
  setting: ChoreNotifySetting,
  today: Date,
  now: Date
): PlannedNotification[] {
  if (!setting.enabled) return [];

  const planned: PlannedNotification[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);

    // その日の家事を、鳴らす時刻ごとにまとめる
    const byTime = new Map<number, string[]>();
    for (const def of getTodaysRoutines(definitions, day)) {
      const at = parseNotifyAt(def.notify_at);
      // 時刻が未設定の家事は通知しない
      if (at === null) continue;
      const labels = byTime.get(at);
      if (labels) labels.push(def.label);
      else byTime.set(at, [def.label]);
    }

    const times = Array.from(byTime.keys()).sort((a, b) => a - b).slice(0, MAX_SLOTS_PER_DAY);

    times.forEach((minutes, slot) => {
      const at = new Date(day);
      at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      // 今日のぶんで、もう時刻を過ぎているならとばす
      if (at.getTime() <= now.getTime()) return;

      const labels = byTime.get(minutes)!;
      planned.push({
        id: ID_BASE + i * MAX_SLOTS_PER_DAY + slot,
        title: `今日の家事 ${labels.length}件`,
        body: bodyFor(labels),
        schedule: { at },
      });
    });
  }

  return planned;
}

// 予約の組み直しは「全部消す → 入れ直す」の2段階なので、2つ同時に走ると
// 片方の cancel がもう片方の schedule を消してしまう。時刻の入力欄は1文字ごとに
// onChange が飛ぶうえ、home タブの再表示でも走るので、実際に重なる。
// 直前の処理を待ってから始めることで順番に流す。
//
// ただし「待つ」はここでは危ない。ネイティブが応答しない1回があると、
// 以降の呼び出しが全部その後ろで止まる。runSync の中の呼び出しは
// すべて withTimeout をかぶせてあるので、チェーンは必ず有限時間で進む。
let syncChain: Promise<void> = Promise.resolve();

export function syncChoreNotifications(definitions: RoutineDefinition[]): Promise<void> {
  syncChain = syncChain.then(() => runSync(definitions)).catch(() => {});
  return syncChain;
}

async function runSync(definitions: RoutineDefinition[]): Promise<void> {
  if (!notificationsAvailable()) return;

  try {
    const LocalNotifications = await plugin();
    const setting = getChoreNotifySetting();

    await cancelOurs();
    if (!setting.enabled) return;

    const perm = await withTimeout(
      LocalNotifications.checkPermissions(), CALL_TIMEOUT_MS, "checkPermissions"
    );
    if (perm.display !== "granted") return;

    const notifications = planChoreNotifications(
      definitions, setting, getJSTToday(), new Date()
    );

    if (notifications.length > 0) {
      await withTimeout(
        LocalNotifications.schedule({ notifications }), CALL_TIMEOUT_MS, "schedule"
      );
    }
  } catch (e) {
    // 通知が予約できなくてもアプリの本体は動く。本体は止めないが、理由は残す。
    recordError("schedule", e);
  }
}

/**
 * いま通知を鳴らせる状態かどうか。設定で許可しておきながら、あとから iOS の
 * 「設定 → 通知」で切られていることがある。その場合ここが false になる。
 */
export async function notificationPermission(): Promise<NotifyPermission> {
  if (!notificationsAvailable()) return "unavailable";
  try {
    const LocalNotifications = await withTimeout(plugin(), CALL_TIMEOUT_MS, "プラグインの読み込み");
    const perm = await withTimeout(
      LocalNotifications.checkPermissions(), CALL_TIMEOUT_MS, "checkPermissions"
    );
    lastError = null;
    return perm.display === "granted" ? "granted" : "denied";
  } catch (e) {
    recordError("checkPermissions", e);
    return "unavailable";
  }
}

/**
 * 設定を切り替えたときに呼ぶ。許可の取得と予約し直しをまとめて行う。
 * オンにできなかったときは理由を返す（画面はそれを出し分ける）。
 */
export async function setChoreNotifyEnabled(
  enabled: boolean,
  definitions: RoutineDefinition[]
): Promise<{ enabled: boolean; permission: NotifyPermission }> {
  if (enabled) {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return { enabled: false, permission };
  }
  saveChoreNotifySetting({ ...getChoreNotifySetting(), enabled });
  await syncChoreNotifications(definitions);
  return { enabled, permission: enabled ? "granted" : await notificationPermission() };
}
