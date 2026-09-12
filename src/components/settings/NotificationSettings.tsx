"use client";

import { useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import {
  notificationsAvailable, getChoreNotifySetting,
  setChoreNotifyEnabled, setChoreNotifyTime,
  syncChoreNotifications, parseNotifyAt,
} from "@/lib/notifications";

// 「今日の家事」の通知設定。ブラウザではローカル通知が使えないので iOS のときだけ出す。
//
// 既定の時刻は端末ごと（localStorage）。家事ごとの時刻は世帯で共有する（DB の notify_at）。
// 「ゴミ出しは朝7時」は2人にとって同じであるべきなので、片方だけずれないようにしている。

const DAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

function whenLabel(r: { frequency: string; day_of_week: number | null; day_of_month: number | null }) {
  if (r.frequency === "daily") return "毎日";
  if (r.frequency === "weekly") return `毎週${DAY_LABEL[r.day_of_week ?? 0]}`;
  if (r.frequency === "monthly") return `毎月${r.day_of_month}日`;
  return "一度だけ";
}

/** "HH:MM:SS" → "HH:MM"（time 入力が読める形）。設定が無ければ空。 */
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
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [denied, setDenied] = useState(false);

  // localStorage を読むので、描画後に反映する（SSR とズレないように）
  useEffect(() => {
    const s = getChoreNotifySetting();
    setEnabled(s.enabled);
    setHour(s.hour);
    setMinute(s.minute);
  }, []);

  // 時刻の早い順に並べる。時刻未設定（＝既定）は最後にまとめる。
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

  const defaultValue = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const toggle = async () => {
    const next = !enabled;
    const ok = await setChoreNotifyEnabled(next, todoRoutines);
    setEnabled(ok);
    // オンにしようとして許可が下りなかった＝端末側で拒否されている
    setDenied(next && !ok);
  };

  const changeDefaultTime = async (value: string) => {
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    setHour(h);
    setMinute(m);
    await setChoreNotifyTime(h, m, todoRoutines);
  };

  const changeChoreTime = async (id: string, value: string) => {
    // 空にしたら既定の時刻に戻す
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
          通知が許可されていません。iPhone の「設定 → 通知 → home」から許可してください。
        </p>
      )}

      {enabled && (
        <>
          <div className="flex items-center gap-2 pl-6">
            <span className="text-[11px] text-muted-foreground">既定</span>
            <input
              type="time"
              value={defaultValue}
              onChange={(e) => changeDefaultTime(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-[12px]"
            />
          </div>

          {sorted.length > 0 && (
            <div className="pl-6 pt-1 space-y-1.5">
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                家事ごとに時刻を変えられます。空にすると既定の時刻になります。
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
            その日の家事があるときだけ鳴ります。同じ時刻の家事はまとめて1回で届きます。
          </p>
        </>
      )}
    </div>
  );
}
