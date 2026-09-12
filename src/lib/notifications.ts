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
  /** 0-23。既定は朝8時。 */
  hour: number;
  minute: number;
}

export const DEFAULT_CHORE_NOTIFY: ChoreNotifySetting = {
  enabled: false,
  hour: 8,
  minute: 0,
};

/** 予約しておく日数。アプリを開かなくてもこの日数ぶんは鳴り続ける。 */
const DAYS_AHEAD = 7;

/** この機能が使う通知IDの範囲。他の用途と衝突しないよう先頭を決めておく。 */
const ID_BASE = 7100;

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

/**
 * 通知の許可を求める。すでに許可済みなら何も出ない。
 * 起動時ではなく、設定で利用者がオンにしたときに呼ぶこと
 * （理由が分からないまま許可を求められると、まず拒否される）。
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  try {
    const LocalNotifications = await plugin();
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch {
    return false;
  }
}

/** この機能が予約したぶんだけ取り消す。他の通知には触らない。 */
async function cancelOurs(): Promise<void> {
  const LocalNotifications = await plugin();
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(
    (n) => n.id >= ID_BASE && n.id < ID_BASE + DAYS_AHEAD
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
 * 何をいつ鳴らすかを決める、副作用の無い部分。
 *
 * ここだけ切り出してあるのは、プラグインを起動せずにテストできるようにするため。
 * 実際の予約は syncChoreNotifications が行う。
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

    const at = new Date(day);
    at.setHours(setting.hour, setting.minute, 0, 0);
    // 今日のぶんで、もう時刻を過ぎているならとばす
    if (at.getTime() <= now.getTime()) continue;

    const labels = getTodaysRoutines(definitions, day).map((d) => d.label);
    // 家事が無い日は予約しない。空の通知で起こされるのが一番嫌われるため。
    if (labels.length === 0) continue;

    planned.push({
      id: ID_BASE + i,
      title: `今日の家事 ${labels.length}件`,
      body: bodyFor(labels),
      schedule: { at },
    });
  }

  return planned;
}

/**
 * 今日から DAYS_AHEAD 日ぶんの通知を予約し直す。
 *
 * 家事は繰り返しの規則から決まるので、先の日付でも中身を計算できる。
 * ただし「予約したあとに済ませた」ぶんは反映できない（予約時点の内容で鳴る）。
 * アプリを開くたびに組み直すことで、ズレを短く抑えている。
 */
export async function syncChoreNotifications(
  definitions: RoutineDefinition[]
): Promise<void> {
  if (!notificationsAvailable()) return;

  try {
    const LocalNotifications = await plugin();
    const setting = getChoreNotifySetting();

    await cancelOurs();
    if (!setting.enabled) return;

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const notifications = planChoreNotifications(
      definitions, setting, getJSTToday(), new Date()
    );

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // 通知が予約できなくてもアプリの本体は動く。黙って諦める。
  }
}

/** 設定を切り替えたときに呼ぶ。許可の取得と予約し直しをまとめて行う。 */
export async function setChoreNotifyEnabled(
  enabled: boolean,
  definitions: RoutineDefinition[]
): Promise<boolean> {
  if (enabled) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }
  saveChoreNotifySetting({ ...getChoreNotifySetting(), enabled });
  await syncChoreNotifications(definitions);
  return enabled;
}

/** 時刻を変えたときに呼ぶ。 */
export async function setChoreNotifyTime(
  hour: number,
  minute: number,
  definitions: RoutineDefinition[]
): Promise<void> {
  saveChoreNotifySetting({ ...getChoreNotifySetting(), hour, minute });
  await syncChoreNotifications(definitions);
}
