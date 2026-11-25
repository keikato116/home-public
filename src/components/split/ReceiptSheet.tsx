"use client";

import { useEffect, useState } from "react";
import { SplitItem } from "@/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort, fmtYen, inputStyle, otherShare } from "./lib";

/** 負担の割合。him と her の両方を出し、どちらを押しても直せる（片方を決めると残りがもう片方） */
function RatioInput({ herRatio, onChange }: { herRatio: number; onChange: (r: number) => void }) {
  const [editing, setEditing] = useState<"him" | "her" | null>(null);
  const [val, setVal] = useState("");
  const herPct = Math.round(herRatio * 100);
  const pctOf = (who: "him" | "her") => (who === "her" ? herPct : 100 - herPct);

  const commit = () => {
    const pct = parseInt(val, 10);
    if (editing && !isNaN(pct) && pct >= 0 && pct <= 100) {
      onChange(editing === "her" ? pct / 100 : (100 - pct) / 100);
    }
    setEditing(null);
  };

  const part = (who: "him" | "her") => (
    <span className="flex items-center gap-1">
      <span className="text-[11px] text-muted-foreground tracking-wider">{who}</span>
      {editing === who ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
          onBlur={commit}
          style={inputStyle}
          className="w-12 bg-transparent border-b border-border text-[13px] text-center outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setVal(String(pctOf(who))); setEditing(who); }}
          className="text-[13px] tabular-nums border-b border-border/40 text-foreground"
        >
          {pctOf(who)}%
        </button>
      )}
    </span>
  );

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground">負担する割合</span>
      {part("him")}
      <span className="text-[11px] text-muted-foreground">:</span>
      {part("her")}
    </div>
  );
}

interface ReceiptSheetProps {
  defaultDate: string;
  defaultHerRatio: number;
  onSave: (data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number; her_ratio?: number }) => Promise<void>;
  onClose: () => void;
}

export function ReceiptSheet({ defaultDate, defaultHerRatio, onSave, onClose }: ReceiptSheetProps) {
  const [store, setStore] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [card, setCard] = useState<"mine" | "family">("mine");
  const [amount, setAmount] = useState("");
  const [herRatio, setHerRatio] = useState(defaultHerRatio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // キーボードが出ているときの、実際に見えている範囲（高さと、上からのずれ）
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    // 後ろの画面が動かないよう指での移動を止める。ただし、この画面のスクロール欄の中は動かせる
    const prevent = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-sheet-scroll]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      document.removeEventListener("touchmove", prevent);
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // キーボードが出ると、見えている範囲が縮み、上にずれることがある。両方に合わせて、
    // 見出しが画面の外に押し出されないようにする。
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop });
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const n = parseInt(amount, 10) || 0;
  // 払っていないほうが負担する額（him が払ったなら her の負担分、her が払ったなら him の負担分）
  const herOwed = Math.round(n * otherShare(card, herRatio));

  const handleSave = async () => {
    if (n <= 0) return;
    setSaving(true);
    setError("");
    try {
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout — check Supabase tables")), 10000)
      );
      await Promise.race([
        onSave({ date, store: store.trim() || "−", card, items: [], shared_amount: n, her_ratio: herRatio }),
        timeout,
      ]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 z-50 bg-background flex flex-col"
      style={{ top: viewport ? `${viewport.top}px` : 0, height: viewport ? `${viewport.height}px` : "100dvh" }}
    >
      <div className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-border/30">
        <button onClick={onClose} className="text-muted-foreground p-1">
          <X size={16} />
        </button>
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase">add receipt</p>
        {/* 左の閉じるボタンと釣り合う幅。見出しを中央に保つためのもの */}
        <div className="w-6" />
      </div>
      {/* 見出しより下は、まとめてスクロールできる。キーボードが出ていても上下に動かして全部見られる */}
      <div data-sheet-scroll className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="px-5 py-6 space-y-4">

        {/* Date + card（だれが払ったか） */}
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-shrink-0">
            <div className="bg-muted/40 rounded-xl px-4 py-3 text-[16px] pointer-events-none select-none whitespace-nowrap">
              {date ? formatDateShort(date) : "date"}
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex gap-2 flex-1">
            {(["mine", "family"] as const).map((v) => (
              <button key={v} onClick={() => setCard(v)}
                className={cn(
                  "flex-1 text-[12px] tracking-wide rounded-xl border py-2.5 transition-colors",
                  card === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}>
                {v === "mine" ? "him が払った" : "her が払った"}
              </button>
            ))}
          </div>
        </div>

        {/* Memo + Amount */}
        <div className="flex items-end gap-4">
          <input
            autoFocus
            type="text"
            value={store === "−" ? "" : store}
            onChange={(e) => setStore(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="memo..."
            style={inputStyle}
            className="flex-1 bg-transparent border-b border-border py-2 outline-none placeholder:text-muted-foreground/50"
          />
          <div className="flex items-end gap-1 border-b border-border py-2 flex-shrink-0">
            <span className="text-muted-foreground pb-0.5">¥</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="0"
              style={inputStyle}
              className="w-28 bg-transparent outline-none placeholder:text-muted-foreground/50 text-right"
            />
          </div>
        </div>

        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>

      <div
        className="px-5 py-4 bg-background border-t border-border/30 space-y-3"
        style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
      >
        {/* Ratio: payer's share */}
        <RatioInput herRatio={herRatio} onChange={setHerRatio} />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">shared total</p>
            <p className="text-[28px] font-light tabular-nums">{fmtYen(n)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
              {card === "mine" ? "her owes" : "him owes"}
            </p>
            <p className="text-[28px] font-light tabular-nums">{fmtYen(herOwed)}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || n <= 0}
          className="w-full bg-foreground text-background rounded-xl py-3.5 text-[13px] tracking-wider disabled:opacity-40"
        >
          {saving ? "saving..." : "save"}
        </button>
      </div>
      </div>
    </div>
  );
}
