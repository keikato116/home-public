"use client";

import { useCallback, useEffect, useState } from "react";
import { useForegroundRefresh } from "@/hooks/useForegroundRefresh";
import { useSplitStore } from "@/store/splitStore";
import { useAuthStore } from "@/store/authStore";
import { SplitSession } from "@/types";
import { ChevronLeft, ChevronRight, Plus, X, Pencil, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateStr, MONTH_NAMES } from "@/lib/dates";
import { LS_SPLIT_CLOSING_DAY, LS_SPLIT_RATIO } from "@/lib/constants";
import { ReceiptSheet } from "./ReceiptSheet";
import { SessionRow } from "./SessionRow";
import { getBillingPeriod, getCurrentPeriod, getSessionRatio, formatDateHeader, fmtYen, inputStyle } from "./lib";

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function SplitTab() {
  const { householdId } = useAuthStore();
  const {
    sessions, familyTotal, subscriptions, loading, settings,
    load, loadSettings, saveSettings, addSession, deleteSession, setFamilyTotal,
    addSubscription, deleteSubscription, updateSessionStore, updateSessionCard, updateSubscriptionCard,
  } = useSplitStore();

  // 締め日と比率は Supabase にあり、世帯で共有する（精算が合わなくなるため）。
  // localStorage はその写しで、DB から返るまでの初回描画に使うだけ。
  // これが無いと、開いた直後だけ暦月で描いてから正しい期間に飛ぶ。

  // Closing day: 0 = calendar month, 1-28 = billing cycle closes on that day
  const [closingDay, setClosingDay] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem(LS_SPLIT_CLOSING_DAY) ?? "0", 10);
  });
  const [editingClosingDay, setEditingClosingDay] = useState(false);
  const [closingDayInput, setClosingDayInput] = useState("");

  // Split ratio: her's share (0.0–1.0), default 0.5
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;
    return parseFloat(localStorage.getItem(LS_SPLIT_RATIO) ?? "0.5");
  });
  const [editingRatio, setEditingRatio] = useState(false);
  const [ratioInput, setRatioInput] = useState("");

  const saveRatio = () => {
    const pct = parseInt(ratioInput, 10);
    const valid = !isNaN(pct) && pct >= 0 && pct <= 100;
    const ratio = valid ? pct / 100 : splitRatio;
    setSplitRatio(ratio);
    localStorage.setItem(LS_SPLIT_RATIO, String(ratio));
    if (householdId) saveSettings(householdId, { her_ratio: ratio });
    setEditingRatio(false);
  };

  const initPeriod = getCurrentPeriod(closingDay);
  const [viewYear, setViewYear] = useState(initPeriod.year);
  const [viewMonth, setViewMonth] = useState(initPeriod.month);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyInput, setFamilyInput] = useState("");

  // Subscription add form
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subCard, setSubCard] = useState<"mine" | "family">("mine");

  const period = getBillingPeriod(viewYear, viewMonth, closingDay);

  const refresh = useCallback(() => {
    if (householdId) load(householdId, period.from, period.to, viewYear, viewMonth);
  }, [householdId, period.from, period.to, viewYear, viewMonth, load]);

  // Initial load (and reload on period change) + refresh on foreground
  useEffect(() => { refresh(); }, [refresh]);
  useForegroundRefresh(refresh);

  useEffect(() => {
    if (householdId) loadSettings(householdId);
  }, [householdId, loadSettings]);

  // DB の値が届いたら、それを正として画面と写しを合わせる。
  // 締め日が変わると表示中の期間もずれるので、現在の期間に取り直す。
  useEffect(() => {
    if (!settings) return;
    setSplitRatio(settings.her_ratio);
    localStorage.setItem(LS_SPLIT_RATIO, String(settings.her_ratio));
    setClosingDay((prev) => {
      if (prev === settings.closing_day) return prev;
      localStorage.setItem(LS_SPLIT_CLOSING_DAY, String(settings.closing_day));
      const p = getCurrentPeriod(settings.closing_day);
      setViewYear(p.year);
      setViewMonth(p.month);
      return settings.closing_day;
    });
  }, [settings]);

  useEffect(() => {
    setFamilyInput(familyTotal ? String(familyTotal.total) : "");
  }, [familyTotal]);

  const goMonth = (dir: number) => {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const saveClosingDay = () => {
    const n = parseInt(closingDayInput, 10);
    const valid = !isNaN(n) && n >= 0 && n <= 28;
    const day = valid ? n : closingDay;
    setClosingDay(day);
    localStorage.setItem(LS_SPLIT_CLOSING_DAY, String(day));
    if (householdId) saveSettings(householdId, { closing_day: day });
    // Jump to current period under new closing day
    const p = getCurrentPeriod(day);
    setViewYear(p.year);
    setViewMonth(p.month);
    setEditingClosingDay(false);
  };

  // Settlement calculation (includes subscriptions)
  // Use per-session ratio; fall back to global splitRatio
  const herFromMine = sessions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.shared_amount * getSessionRatio(s, splitRatio), 0);
  const herFromFamily = sessions.filter(s => s.card === "family").reduce((sum, s) => sum + s.shared_amount * getSessionRatio(s, splitRatio), 0);
  const subsMine = subscriptions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.amount, 0);
  const subsFamily = subscriptions.filter(s => s.card === "family").reduce((sum, s) => sum + s.amount, 0);
  // Her share of each side, per-session ratio included, so the breakdown below always
  // adds up to the headline figure (himSplits + herCardBill − herSplits = gfOwesRaw).
  const himSplits = herFromMine + subsMine * splitRatio;
  const herSplits = herFromFamily + subsFamily * splitRatio;
  const familyCardTotal = familyTotal?.total ?? 0;
  const gfOwesRaw = himSplits + familyCardTotal - herSplits;
  const netPositive = gfOwesRaw >= 0;

  const byDate: Record<string, SplitSession[]> = {};
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // Default date for new receipts: today if within period, else period end
  const today = new Date();
  const todayStr = toDateStr(today);
  const defaultDate = todayStr >= period.from && todayStr <= period.to ? todayStr : period.to;

  const handleSaveFamilyTotal = async () => {
    if (!householdId) return;
    const n = parseInt(familyInput, 10);
    if (isNaN(n) || n < 0) return;
    await setFamilyTotal(householdId, viewYear, viewMonth, n);
    setEditingFamily(false);
  };

  const handleAddSubscription = async () => {
    const amount = parseInt(subAmount, 10);
    if (!subName.trim() || !amount || amount <= 0 || !householdId) return;
    await addSubscription(householdId, { name: subName.trim(), amount, card: subCard });
    setSubName("");
    setSubAmount("");
    setSubCard("mine");
    setAddingSub(false);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-x-hidden">
      {/* Period navigation */}
      <div className="px-6 pt-12 pb-2 flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="text-muted-foreground p-1"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <p className="text-[12px] tracking-[0.2em]">{MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}</p>
          {period.rangeLabel && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{period.rangeLabel}</p>
          )}
        </div>
        <button onClick={() => goMonth(1)} className="text-muted-foreground p-1"><ChevronRight size={16} /></button>
      </div>

      {/* Closing day + ratio settings */}
      <div className="px-6 pb-3 flex items-center justify-end gap-4">
        {/* Split ratio */}
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] text-muted-foreground/60 tracking-wider">her %:</p>
          {editingRatio ? (
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={ratioInput}
              onChange={(e) => setRatioInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveRatio(); if (e.key === "Escape") setEditingRatio(false); }}
              onBlur={saveRatio}
              placeholder={String(Math.round(splitRatio * 100))}
              style={inputStyle}
              className="w-10 bg-transparent text-[9px] text-center outline-none border-b border-border text-muted-foreground"
            />
          ) : (
            <button
              onClick={() => { setRatioInput(String(Math.round(splitRatio * 100))); setEditingRatio(true); }}
              className="flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <span className="text-[9px]">{Math.round((1 - splitRatio) * 100)}:{Math.round(splitRatio * 100)}</span>
              <Pencil size={8} />
            </button>
          )}
        </div>

        {/* Closing day */}
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] text-muted-foreground/60 tracking-wider">closing day:</p>
          {editingClosingDay ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={closingDayInput}
                onChange={(e) => setClosingDayInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveClosingDay(); if (e.key === "Escape") setEditingClosingDay(false); }}
                onBlur={saveClosingDay}
                placeholder={String(closingDay || "−")}
                style={inputStyle}
                className="w-10 bg-transparent text-[9px] text-center outline-none border-b border-border text-muted-foreground"
              />
              <p className="text-[9px] text-muted-foreground/60">日</p>
            </div>
          ) : (
            <button
              onClick={() => { setClosingDayInput(closingDay > 0 ? String(closingDay) : ""); setEditingClosingDay(true); }}
              className="flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <span className="text-[9px]">{closingDay > 0 ? `${closingDay}日` : "未設定"}</span>
              <Pencil size={8} />
            </button>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="mx-6 mb-3 bg-muted/40 rounded-2xl px-5 py-4 space-y-3">
        <div>
          <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1">
            {netPositive ? "her owes" : "him owes"}
          </p>
          <p className={cn("text-[38px] font-light tracking-tight tabular-nums", !netPositive && "text-blue-500")}>
            {fmtYen(gfOwesRaw)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border/20">
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">him splits</p>
            <p className="text-[12px] tabular-nums">{fmtYen(himSplits)}</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">her card bill</p>
            {editingFamily ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-[11px]">¥</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  value={familyInput}
                  onChange={(e) => setFamilyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveFamilyTotal(); if (e.key === "Escape") setEditingFamily(false); }}
                  onBlur={handleSaveFamilyTotal}
                  style={inputStyle}
                  className="w-20 bg-transparent text-center outline-none border-b border-border"
                />
              </div>
            ) : (
              <button onClick={() => setEditingFamily(true)} className="flex items-center gap-1 mx-auto">
                <span className="text-[12px] tabular-nums">{familyCardTotal > 0 ? fmtYen(familyCardTotal) : "−"}</span>
                <Pencil size={9} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">her splits (−)</p>
            <p className="text-[12px] text-blue-500 tabular-nums">−{fmtYen(herSplits)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
        {/* Session list */}
        {loading && <p className="text-[10px] text-muted-foreground text-center py-4">loading...</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-8">no receipts this month</p>
        )}
        {dates.map((date) => (
          <div key={date} className="mb-4">
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">
              {formatDateHeader(date)}
            </p>
            {byDate[date].map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                fallbackRatio={splitRatio}
                onDelete={() => deleteSession(session.id)}
                onUpdateStore={(store) => updateSessionStore(session.id, store)}
                onUpdateCard={(card) => updateSessionCard(session.id, card)}
              />
            ))}
          </div>
        ))}

        {/* Add receipt button — prominent */}
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center justify-center gap-2 mt-2 py-3.5 rounded-xl border border-border/60 text-[12px] tracking-wider text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Plus size={14} />
          add receipt
        </button>

        {/* Subscriptions — settings section at bottom */}
        <div className="mt-8 pt-5 border-t border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <RefreshCw size={10} className="text-muted-foreground/60" />
              <p className="text-[9px] tracking-widest text-muted-foreground/60 uppercase">subscriptions</p>
            </div>
            <button onClick={() => setAddingSub(!addingSub)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <Plus size={13} />
            </button>
          </div>

          {addingSub && (
            <div className="mb-2 pb-2 border-b border-border/30 space-y-2">
              <input
                type="text"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSubscription(); }}
                placeholder="name..."
                autoFocus
                style={inputStyle}
                className="w-full bg-transparent border-b border-border py-1 outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border-b border-border flex-1">
                  <span className="text-muted-foreground">¥</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSubscription(); }}
                    placeholder="0"
                    style={inputStyle}
                    className="w-full bg-transparent py-1 outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={() => setSubCard(subCard === "mine" ? "family" : "mine")}
                  className={cn(
                    "text-[10px] tracking-wide px-3 py-1.5 rounded-lg border flex-shrink-0 transition-colors",
                    subCard === "mine" ? "border-border text-muted-foreground" : "border-blue-400/50 text-blue-500"
                  )}>
                  {subCard === "mine" ? "him" : "her"}
                </button>
                <button onClick={handleAddSubscription} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <Plus size={15} />
                </button>
              </div>
            </div>
          )}

          {subscriptions.length === 0 && !addingSub && (
            <p className="text-[10px] text-muted-foreground/40">no subscriptions</p>
          )}
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 py-1.5 border-b border-border/10">
              <span className="flex-1 text-[12px] text-muted-foreground">{sub.name}</span>
              <span className="text-[12px] tabular-nums text-muted-foreground/60">¥{sub.amount.toLocaleString()}</span>
              <button
                onClick={() => updateSubscriptionCard(sub.id, sub.card === "mine" ? "family" : "mine")}
                className={cn(
                  "text-[9px] tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors",
                  sub.card === "mine" ? "border-border/60 text-muted-foreground/60" : "border-blue-400/30 text-blue-400"
                )}
                aria-label="toggle him/her"
              >
                {sub.card === "mine" ? "him" : "her"}
              </button>
              <button onClick={() => deleteSubscription(sub.id)} className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {sheetOpen && (
        <ReceiptSheet
          defaultDate={defaultDate}
          defaultHerRatio={splitRatio}
          onSave={(data) => addSession(householdId!, data)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
