"use client";

import { usePrefsStore } from "@/store/prefsStore";
import { useAuthStore } from "@/store/authStore";
import { HIDEABLE_TABS, PAIR_ONLY_TABS } from "@/lib/constants";

// 下のバーに出すタブの切り替え。使わない機能を隠せる。端末ごとの好みなので
// localStorage に置いている（prefsStore）。隠してもデータは消えず、出し直せば元どおり。

export function TabSettings() {
  const { hiddenTabs, setTabHidden } = usePrefsStore();
  const memberCount = useAuthStore((s) => s.memberCount);
  const solo = memberCount !== null && memberCount <= 1;

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">tabs</p>

      <div className="space-y-2.5">
        {HIDEABLE_TABS.map(({ id, label }) => {
          const pairOnly = (PAIR_ONLY_TABS as readonly string[]).includes(id);
          return (
            <label key={id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!hiddenTabs.includes(id)}
                onChange={(e) => setTabHidden(id, !e.target.checked)}
                className="w-3.5 h-3.5 accent-foreground cursor-pointer"
              />
              <span className="text-[12px] tracking-wide">{label}</span>
              {pairOnly && solo && (
                <span className="text-[10px] text-muted-foreground">（2人で使うときに出ます）</span>
              )}
            </label>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        チェックを外したタブは下のバーに出なくなります。データは消えないので、チェックを戻せば元どおり使えます。
        ホームはいつも表示されます。この設定はこの端末だけに効きます。
      </p>
    </div>
  );
}
