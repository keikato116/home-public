"use client";

import { useJoinRequests } from "@/lib/joinRequests";

// 参加の申請を出す・受ける画面の部品。ホームと 設定 → household に置く。
// 申請が無ければ何も出さない。

export function JoinRequestsPanel() {
  const { incoming, outgoing, busy, error, approve, decline, cancel } = useJoinRequests();

  if (incoming.length === 0 && !outgoing && !error) return null;

  return (
    <div className="space-y-3">
      {incoming.map((r) => {
        const who = r.name || "名前未設定の方";
        return (
          <div key={r.requester_id} className="border border-border rounded-2xl px-5 py-4 space-y-3">
            <p className="text-[12px] leading-relaxed">
              {r.returning
                ? `前に一緒に使っていた ${who} さんから、戻る申請が届いています。`
                : `${who} さんから、この世帯への参加の申請が届いています。`}
            </p>
            {r.email && <p className="text-[11px] text-muted-foreground break-all">{r.email}</p>}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              承認すると、予定・家事・買い物などが2人で共有されます。心当たりがなければ断ってください。
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => approve(r.requester_id)}
                disabled={busy}
                className="px-5 py-2 bg-foreground text-background text-[11px] tracking-wider rounded-full disabled:opacity-50"
              >
                承認する
              </button>
              <button
                onClick={() => decline(r.requester_id)}
                disabled={busy}
                className="text-[11px] text-muted-foreground underline disabled:opacity-50"
              >
                断る
              </button>
            </div>
          </div>
        );
      })}

      {outgoing && (
        <div className="border border-border rounded-2xl px-5 py-4 space-y-3">
          <p className="text-[12px] leading-relaxed">
            {outgoing.returning ? "前の世帯に戻る申請を出しました。" : "参加の申請を出しました。"}
            お相手が承認すると、自動で2人用に切り替わります。
          </p>
          <button
            onClick={cancel}
            disabled={busy}
            className="text-[11px] text-muted-foreground underline disabled:opacity-50"
          >
            申請を取り消す
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 leading-relaxed">{error}</p>}
    </div>
  );
}
