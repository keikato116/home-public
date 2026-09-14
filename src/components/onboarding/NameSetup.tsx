"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { suggestDisplayName, normalizeDisplayName, MAX_DISPLAY_NAME } from "@/lib/displayName";

// 名前を尋ねる画面。世帯に入ったあと、表示名が未設定のときだけ出る。
//
// 以前は名前を Google のプロフィールから取っていたが、それだと
// Apple だけで入った人は名無しのままで、予定の持ち主も家事の完了者も
// 誰なのか分からなかった。相手に見える名前なので、本人に決めてもらう。
//
// ログイン方法から名前が分かるときは初期値に入れておく（そのまま進める）。
// Apple は名前を渡さないことがあり、その場合は空で出る。

export function NameSetup() {
  const { user, saveDisplayName } = useAuthStore();
  const [name, setName] = useState(() => suggestDisplayName(user));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const valid = normalizeDisplayName(name) !== null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveDisplayName(name);
    } catch {
      // 保存できないまま進ませると名無しで始まってしまうので、ここで止める
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7">
      <form onSubmit={submit} className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">name</p>
          <h1 className="text-2xl tracking-wide">お名前は？</h1>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            相手に表示される名前です。予定や家事を、どちらのものか見分けるのに使います。
            あとから設定で変えられます。
          </p>
        </div>

        <div className="space-y-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_DISPLAY_NAME * 2}
            placeholder="けい"
            className="w-full bg-background border border-border rounded px-3 py-3 text-[13px] tracking-wide"
          />
          <p className="text-[10px] text-muted-foreground/70">
            {MAX_DISPLAY_NAME}文字まで
          </p>
        </div>

        <button
          type="submit"
          disabled={!valid || saving}
          className="w-full bg-foreground text-background rounded min-h-[44px] px-4 py-3 text-[13px] disabled:opacity-40"
        >
          {saving ? "保存中…" : "はじめる"}
        </button>

        {failed && (
          <p className="text-[11px] text-red-500 leading-relaxed">
            保存できませんでした。通信を確認してもう一度お試しください。
          </p>
        )}
      </form>
    </div>
  );
}
