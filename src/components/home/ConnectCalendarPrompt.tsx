"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_CALENDAR_PROMPT_DISMISSED } from "@/lib/constants";

// Apple などで登録して、まだ Google を繋いでいない人に、ホームの一番上で連携を案内する。
// Apple でログインした人は、このままだとカレンダーに予定が出ず、アプリの中心の機能が
// 使えていない。連携は今のアカウントに Google を紐付けるだけで、アカウントは変わらない
// （src/lib/googleToken.ts の connectGoogleCalendar）。
// 「あとで」を押したら、その端末では二度と出さない（カレンダーのタブからいつでも繋げる）。

export function ConnectCalendarPrompt() {
  const user = useAuthStore((s) => s.user);
  const reAuthGoogle = useAuthStore((s) => s.reAuthGoogle);
  const [dismissed, setDismissed] = useState(() => getJSON<boolean>(LS_CALENDAR_PROMPT_DISMISSED, false));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGoogle = user?.identities?.some((i) => i.provider === "google") ?? true;
  if (!user || hasGoogle || dismissed) return null;

  const connect = async () => {
    setWorking(true);
    setError(null);
    try {
      await reAuthGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "連携できませんでした");
    }
    setWorking(false);
  };

  const later = () => {
    setJSON(LS_CALENDAR_PROMPT_DISMISSED, true);
    setDismissed(true);
  };

  return (
    <div className="border border-border rounded-2xl px-5 py-4 space-y-3">
      <p className="text-[12px] leading-relaxed">
        Google カレンダーを連携すると、2人の予定を1つのカレンダーで見られます。
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        いまのアカウントのまま連携します。予定は読み取るだけで、保存はしません。
      </p>
      {error && <p className="text-[11px] text-red-500 leading-relaxed">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          onClick={connect}
          disabled={working}
          className="px-5 py-2 bg-foreground text-background text-[11px] tracking-wider rounded-full disabled:opacity-50"
        >
          {working ? "ひらいています..." : "連携する"}
        </button>
        <button onClick={later} className="text-[11px] text-muted-foreground underline">
          あとで
        </button>
      </div>
    </div>
  );
}
