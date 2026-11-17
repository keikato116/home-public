import { create } from "zustand";
import { getJSON, setJSON } from "@/lib/storage";
import { LS_MEAL_AUTO_DETECT, LS_HIDDEN_TABS } from "@/lib/constants";

// 端末ごとの表示の好み。世帯で共有するデータではないので localStorage に置く。
//
// store にしてあるのは、切り替えたときに献立とカレンダーの両方が描き直る必要が
// あるため。localStorage を直接読むと、設定を変えても画面が変わらない。

interface PrefsState {
  /**
   * 献立の「ここは空いていそう」の自動判定を出すか。
   *
   * 予定の入っていない夜と、休日や二人とも終日予定の昼を、献立を立てる候補として
   * 色付けする機能。当たらないことが多く、既定では出さない。
   */
  mealAutoDetect: boolean;
  setMealAutoDetect: (on: boolean) => void;

  /** 設定で非表示にしたタブの id。使わない機能のタブを下のバーから外せる。 */
  hiddenTabs: string[];
  setTabHidden: (id: string, hidden: boolean) => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  // SSR と最初の描画を一致させるため、既定値のまま作る。
  // 実際の値は hydratePrefs() が描画後に入れる。
  mealAutoDetect: false,

  setMealAutoDetect: (on) => {
    setJSON(LS_MEAL_AUTO_DETECT, on);
    set({ mealAutoDetect: on });
  },

  hiddenTabs: [],

  setTabHidden: (id, hidden) => {
    const next = hidden
      ? Array.from(new Set([...get().hiddenTabs, id]))
      : get().hiddenTabs.filter((t) => t !== id);
    setJSON(LS_HIDDEN_TABS, next);
    set({ hiddenTabs: next });
  },
}));

/** localStorage の値を読み込む。クライアントで一度だけ呼ぶ。 */
export function hydratePrefs(): void {
  usePrefsStore.setState({
    mealAutoDetect: getJSON<boolean>(LS_MEAL_AUTO_DETECT, false),
    hiddenTabs: getJSON<string[]>(LS_HIDDEN_TABS, []),
  });
}
