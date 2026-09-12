"use client";

import { useEffect, useState } from "react";
import { useTodoStore } from "@/store/todoStore";
import {
  notificationsAvailable, getChoreNotifySetting,
  setChoreNotifyEnabled, setChoreNotifyTime,
} from "@/lib/notifications";

// 「今日の家事」の通知設定。
// ブラウザではローカル通知が使えないので、iOS アプリのときだけ出す。

export function NotificationSettings() {
  // settingsStore ではなく todoStore を見る。home タブが起動時に読むので
  // 設定を開いた時点で確実に入っている。
  const routineDefinitions = useTodoStore((s) => s.routineDefinitions);
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

  if (!notificationsAvailable()) return null;

  const toggle = async () => {
    const next = !enabled;
    const ok = await setChoreNotifyEnabled(next, routineDefinitions);
    setEnabled(ok);
    // オンにしようとして許可が下りなかった＝端末側で拒否されている
    setDenied(next && !ok);
  };

  const changeTime = async (h: number, m: number) => {
    setHour(h);
    setMinute(m);
    await setChoreNotifyTime(h, m, routineDefinitions);
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

      {enabled && (
        <div className="flex items-center gap-2 pl-6">
          <input
            type="time"
            value={`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (!Number.isNaN(h) && !Number.isNaN(m)) changeTime(h, m);
            }}
            className="bg-background border border-border rounded px-2 py-1 text-[12px]"
          />
          <span className="text-[11px] text-muted-foreground">に通知</span>
        </div>
      )}

      {denied ? (
        <p className="text-[11px] text-red-500 leading-relaxed">
          通知が許可されていません。iPhone の「設定 → 通知 → home」から許可してください。
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          その日の家事があるときだけ鳴ります。無い日は通知しません。
        </p>
      )}
    </div>
  );
}
