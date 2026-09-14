"use client";

import { useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import {
  notificationsAvailable, getChoreNotifySetting,
  setChoreNotifyEnabled, syncChoreNotifications, parseNotifyAt,
  notificationPermissionGranted,
} from "@/lib/notifications";

// 「今日の家事」の通知設定。ブラウザではローカル通知が使えないので iOS のときだけ出す。
//
// 時刻は家事ごとに設定する（DB の notify_at）。世帯で共有する値にしているのは、
// 「ゴミ出しは朝7時」が2人にとって同じであるべきだから。オン・オフだけ端末ごと。
//
// 時刻が空の家事は通知しない。家事を足しただけで通知が勝手に増えるより、
// 鳴らしたいものを選んでもらうほうが、通知を切られにくい。

const DAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

function whenLabel(r: { frequency: string; day_of_week: number | null; day_of_month: number | null }) {
  if (r.frequency === "daily") return "毎日";
  if (r.frequency === "weekly") return `毎週${DAY_LABEL[r.day_of_week ?? 0]}`;
  if (r.frequency === "monthly") return `毎月${r.day_of_month}日`;
  return "一度だけ";
}

/** "HH:MM:SS" → "HH:MM"（time 入力が読める形）。未設定なら空＝通知しない。 */
function toInputValue(notifyAt: string | null): string {
  const mins = parseNotifyAt(notifyAt);
  if (mins === null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function NotificationSettings() {
  const { routineDefinitions, setRoutineNotifyAt } = useSettingsStore();
  // 予約の組み直しには home タブが読むほうの一覧を使う（起動時から入っている）
  const todoRoutines = useTodoStore((s) => s.routineDefinitions);

  const [enabled, setEnabled] = useState(false);
  const [denied, setDenied] = useState(false);

  // localStorage を読むので、描画後に反映する（SSR とズレないように）。
  // あわせて端末側の許可も確かめる。アプリの設定はオンのまま iOS の
  // 「設定 → 通知」で切られていることがあり、そのままだと
  // 「オンなのに鳴らない」が黙って続く。
  useEffect(() => {
    const on = getChoreNotifySetting().enabled;
    setEnabled(on);
    if (on) notificationPermissionGranted().then((ok) => setDenied(!ok));
  }, []);

  // 時刻の早い順に並べる。未設定（＝通知しない）は最後にまとめる。
  const sorted = useMemo(() => {
    return [...routineDefinitions].sort((a, b) => {
      const am = parseNotifyAt(a.notify_at);
      const bm = parseNotifyAt(b.notify_at);
      if (am === null && bm === null) return a.label.localeCompare(b.label);
      if (am === null) return 1;
      if (bm === null) return -1;
      return am - bm;
    });
  }, [routineDefinitions]);

  if (!notificationsAvailable()) return null;

  const toggle = async () => {
    const next = !enabled;
    const ok = await setChoreNotifyEnabled(next, todoRoutines);
    setEnabled(ok);
    // オンにしようとして許可が下りなかった＝端末側で拒否されている
    setDenied(next && !ok);
  };

  const changeChoreTime = async (id: string, value: string) => {
    // 空にしたら、その家事は通知しない
    await setRoutineNotifyAt(id, value ? `${value}:00` : null);
    await syncChoreNotifications(
      todoRoutines.map((r) => (r.id === id ? { ...r, notify_at: value ? `${value}:00` : null } : r))
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">notification</p>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="w-3.5 h-3.5 accent-foreground cursor-pointer"
        />
        <span className="text-[12px] tracking-wide">今日の家事を知らせる</span>
      </label>

      {denied && (
        <p className="text-[11px] text-red-500 leading-relaxed">
          通知が許可されていません。iPhone の「設定 → 通知 → Imbrex」から許可してください。
        </p>
      )}

      {enabled && (
        <>
          {sorted.length > 0 && (
            <div className="pl-6 pt-1 space-y-1.5">
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                知らせてほしい家事に時刻を入れてください。空のままなら通知しません。
              </p>
              {sorted.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="flex-1 text-[12px] truncate">{r.label}</span>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                    {whenLabel(r)}
                  </span>
                  <input
                    type="time"
                    value={toInputValue(r.notify_at)}
                    onChange={(e) => changeChoreTime(r.id, e.target.value)}
                    className="bg-background border border-border rounded px-2 py-0.5 text-[11px] w-[88px] flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            時刻を入れた家事が、その日にあるときだけ鳴ります。
            同じ時刻の家事はまとめて1回で届きます。
          </p>
        </>
      )}
    </div>
  );
}
