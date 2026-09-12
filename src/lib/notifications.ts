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

/** 1日に鳴らせる時刻の数の上限。これを超える時刻が設定されたぶんは早い順に切る。 */
const MAX_SLOTS_PER_DAY = 6;

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
 * 家事ごとに notify_at を持てる（朝やる家事と夜やる家事を分けるため）。
 * 設定が無い家事は、端末側の既定の時刻にまとめて鳴らす。
 * 同じ時刻の家事は1件の通知にまとめる。
 */
export function planChoreNotifications(
  definitions: RoutineDefinition[],
  setting: ChoreNotifySetting,
  today: Date,
  now: Date
): PlannedNotification[] {
  if (!setting.enabled) return [];

  const fallback = setting.hour * 60 + setting.minute;
  const planned: PlannedNotification[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);

    // その日の家事を、鳴らす時刻ごとにまとめる
    const byTime = new Map<number, string[]>();
    for (const def of getTodaysRoutines(definitions, day)) {
      const at = parseNotifyAt(def.notify_at) ?? fallback;
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
