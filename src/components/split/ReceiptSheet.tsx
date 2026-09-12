"use client";

import { useEffect, useState } from "react";
import { SplitItem } from "@/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort, fmtYen, inputStyle } from "./lib";

function RatioInput({ card, herRatio, onChange }: { card: "mine" | "family"; herRatio: number; onChange: (r: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const payerPct = card === "mine" ? Math.round((1 - herRatio) * 100) : Math.round(herRatio * 100);
  const payer = card === "mine" ? "him" : "her";

  const commit = () => {
    const pct = parseInt(val, 10);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      onChange(card === "mine" ? (100 - pct) / 100 : pct / 100);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground tracking-wider">{payer}</span>
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          onBlur={commit}
          style={inputStyle}
          className="w-12 bg-transparent border-b border-border text-[13px] text-center outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setVal(String(payerPct)); setEditing(true); }}
          className="text-[13px] tabular-nums border-b border-border/40 text-foreground"
        >
          {payerPct}%
        </button>
      )}
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
  const [vpHeight, setVpHeight] = useState<number | null>(null);

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
    const prevent = (e: TouchEvent) => e.preventDefault();
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
    const update = () => setVpHeight(vv.height);
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, []);

  const n = parseInt(amount, 10) || 0;
  const herOwed = Math.round(n * herRatio);

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
    <div className="fixed inset-x-0 top-0 z-50 bg-background flex flex-col" style={{ height: vpHeight ? `${vpHeight}px` : "100dvh" }}>
      <div className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-border/30">
        <button onClick={onClose} className="text-muted-foreground p-1">
          <X size={16} />
        </button>
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase">add receipt</p>
        {/* 左の閉じるボタンと釣り合う幅。見出しを中央に保つためのもの */}
        <div className="w-6" />
      </div>
      <div className="flex-1 px-5 py-6 space-y-4">

        {/* Date + card */}
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
                {v === "mine" ? "him" : "her"}
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
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {/* Ratio: payer's share */}
        <RatioInput card={card} herRatio={herRatio} onChange={setHerRatio} />

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
  );
}
