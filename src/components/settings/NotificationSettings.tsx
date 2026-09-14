"use client";

import { useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useTodoStore } from "@/store/todoStore";
import type { NotifyPermission } from "@/lib/notifications";
import {
  notificationsAvailable, getChoreNotifySetting,
  setChoreNotifyEnabled, syncChoreNotifications, parseNotifyAt,
  notificationPermission, lastNotificationError, nativePluginPresent, bridgeProbe,
} from "@/lib/notifications";

// 「今日の家事」の通知設定。
//
// ここには性質の違う2つが並んでいる。混ぜないこと。
//
//   時刻（DB の notify_at） … 世帯で共有。「ゴミ出しは朝7時」は2人にとって同じ
//   オン・オフ（localStorage）  … 端末ごと。「この iPhone で鳴らすか」
//
// 以前は時刻の一覧をオン・オフの内側に入れていたが、これだと共有設定に
// 端末の都合で触れなくなる。実際に2通りの行き止まりがあった:
//   - 通知の許可を一度拒否すると iOS は二度とダイアログを出さないので
//     チェックが入らず、時刻欄に永久に到達できない
//   - ブラウザではセクションごと消えるので、ウェブから時刻を直せない
// いまは時刻の一覧を常に出し、チェックは配信のスイッチだけに絞ってある。
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
  const [permission, setPermission] = useState<NotifyPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const canNotify = notificationsAvailable();

  // localStorage を読むので、描画後に反映する（SSR とズレないように）。
  // あわせて端末側の許可も確かめる。アプリの設定はオンのまま iOS の
  // 「設定 → 通知」で切られていることがあり、そのままだと
  // 「オンなのに鳴らない」が黙って続く。
  useEffect(() => {
    setEnabled(getChoreNotifySetting().enabled);
    // 設定に関係なく毎回聞く。checkPermissions は利用者に何も見せず即座に返る
    // はずのものなので、返らない・落ちること自体がネイティブ側の異常を示す。
    // 画面を開いた時点で分かるので、チェックを押してもらう必要がない。
    if (!notificationsAvailable()) return;
    notificationPermission().then((p) => {
      setPermission(p);
      setError(lastNotificationError());
      // 応答が無かったときだけ、ブリッジ自体を別のプラグインで確かめる
      if (p === "unavailable") bridgeProbe().then(setProbe);
    });
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

  const toggle = async () => {
    // 押しても何も起きないように見えるのが一番困る。許可を尋ねている間は
    // 目に見えて止めておき、終わったら結果か理由のどちらかを必ず出す。
    setBusy(true);
    try {
      const res = await setChoreNotifyEnabled(!enabled, todoRoutines);
      setEnabled(res.enabled);
      setPermission(res.permission);
      setError(lastNotificationError());
    } catch (e) {
      setPermission("unavailable");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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

      {/* 配信のスイッチ。鳴らせる端末でだけ意味があるので、ブラウザでは出さない。
          時刻の一覧（下）はこれに関係なく出す。 */}
      {canNotify && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
            disabled={busy}
            className="w-3.5 h-3.5 accent-foreground cursor-pointer"
          />
          <span className="text-[12px] tracking-wide">
            この端末で知らせる{busy && "（確認中…）"}
          </span>
        </label>
      )}

      {/* 「チェックが入らない」の原因は2つあり、見た目で区別がつかない。
          文面を分けないと、利用者も開発側も設定アプリを探し回ることになる。 */}
      {canNotify && permission === "denied" && (
        <p className="text-[11px] text-red-500 leading-relaxed">
          通知が許可されていません。iPhone の「設定 → 通知 → Imbrex」から許可してください。
          許可しなくても、下の時刻は設定できます。
        </p>
      )}

      {canNotify && permission === "unavailable" && (
        <p className="text-[11px] text-red-500 leading-relaxed">
          このバージョンのアプリは通知に対応していません。更新をお待ちください。
          時刻の設定はいまのうちにしておけます。
        </p>
      )}

      {/* 端末が手元に無い側から原因を追えるように、状態をそのまま出す。
          plugin=no ならネイティブ側に実体が無い（ビルドの問題）。
          plugin=yes なのに応答しないなら、実体はあるが動いていない。 */}
      {canNotify && (permission === "unavailable" || error) && (
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed break-all">
          plugin={nativePluginPresent() ? "yes" : "no"}
          {error ? ` / ${error}` : ""}
          {probe ? ` / ${probe}` : ""}
        </p>
      )}

      <div className="pt-1 space-y-1.5">
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          知らせてほしい家事に時刻を入れてください。空のままなら通知しません。
          時刻は2人で共有されます。
        </p>

        {sorted.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            家事がまだありません。先に家事を追加してください。
          </p>
        ) : (
          sorted.map((r) => (
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
          ))
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {canNotify
          ? "時刻を入れた家事が、その日にあるときだけ鳴ります。同じ時刻の家事はまとめて1回で届きます。"
          : "通知が鳴るのは iPhone のアプリだけです。ここで入れた時刻はそちらに反映されます。"}
      </p>
    </div>
  );
}
