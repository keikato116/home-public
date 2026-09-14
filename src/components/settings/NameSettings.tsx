"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { normalizeDisplayName, MAX_DISPLAY_NAME } from "@/lib/displayName";

// 表示名の変更。初回は NameSetup で尋ね、以降はここで直す。

export function NameSettings() {
  const { displayName, saveDisplayName, loadDisplayName } = useAuthStore();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // 設定を開いた時点の値を入れる。開いている間に相手が変えるものではないので
  // 一度だけでよい。
  useEffect(() => {
    if (displayName === null) loadDisplayName();
    else setValue(displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName === null]);

  const normalized = normalizeDisplayName(value);
  const changed = normalized !== null && normalized !== displayName;

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveDisplayName(value);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">name</p>

      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_DISPLAY_NAME * 2}
          placeholder="けい"
          className="flex-1 bg-background border border-border rounded px-3 py-2 text-[12px] tracking-wide"
        />
        <button
          onClick={save}
          disabled={!changed || saving}
          className="border border-border rounded px-3 py-2 text-[11px] tracking-wide disabled:opacity-40"
        >
          {saving ? "…" : "保存"}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        相手に表示される名前です。予定や家事の持ち主として出ます。{MAX_DISPLAY_NAME}文字まで。
      </p>

      {failed && (
        <p className="text-[11px] text-red-500">保存できませんでした。</p>
      )}
    </div>
  );
}
