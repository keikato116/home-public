"use client";

import { usePrefsStore } from "@/store/prefsStore";

// 献立の自動判定の表示切り替え。端末ごとの好みなので localStorage に置いている。

export function MealSettings() {
  const { mealAutoDetect, setMealAutoDetect } = usePrefsStore();

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">meal</p>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={mealAutoDetect}
          onChange={(e) => setMealAutoDetect(e.target.checked)}
          className="w-3.5 h-3.5 accent-foreground cursor-pointer"
        />
        <span className="text-[12px] tracking-wide">空いてそうな日を自動で表示する</span>
      </label>

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        予定の入っていない夜と、休日や二人とも終日予定の昼を、献立の候補として色付けします。
        自分で付けた昼ごはん・夜ご飯の印は、この設定に関係なく残ります。
      </p>
    </div>
  );
}
