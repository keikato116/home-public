"use client";

import { useEffect, useRef, useState } from "react";
import { useSplitStore } from "@/store/splitStore";
import { useAuthStore } from "@/store/authStore";
import { SplitItem, SplitSession } from "@/types";
import { ChevronLeft, ChevronRight, Camera, Plus, X, Pencil, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}
function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtYen(n: number) {
  return `¥${Math.round(Math.abs(n)).toLocaleString()}`;
}

// Returns the billing period for a given (viewYear, viewMonth, closingDay)
// closingDay=0 means calendar month; 1-28 means "period ends on closingDay of viewMonth"
function getBillingPeriod(viewYear: number, viewMonth: number, closingDay: number) {
  if (closingDay === 0) {
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    return {
      from: `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-01`,
      to:   `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(days).padStart(2,"0")}`,
      rangeLabel: null as string | null,
    };
  }
  const end   = new Date(viewYear, viewMonth, closingDay);
  const start = new Date(viewYear, viewMonth - 1, closingDay + 1);
  return {
    from: toDateStr(start),
    to:   toDateStr(end),
    rangeLabel: `${MON_SHORT[start.getMonth()]} ${start.getDate()} – ${MON_SHORT[end.getMonth()]} ${end.getDate()}`,
  };
}

// Returns the period (year, month) that contains today given a closingDay
function getCurrentPeriod(closingDay: number) {
  const today = new Date();
  const d = today.getDate();
  const m = today.getMonth();
  const y = today.getFullYear();
  if (closingDay === 0 || d <= closingDay) return { year: y, month: m };
  const next = new Date(y, m + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

// iOS prevents zoom when font-size >= 16px
const inputStyle = { fontSize: "16px" };

const RATIO_KEY = "__ratio__";

function getSessionRatio(session: SplitSession, fallback: number): number {
  const ri = session.items.find((i) => i.name === RATIO_KEY);
  return ri !== undefined ? ri.price : fallback;
}

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
          style={{ fontSize: "16px" }}
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

// ─── Receipt / Item Entry Sheet ───────────────────────────────────────────────

interface ReceiptSheetProps {
  defaultDate: string;
  defaultHerRatio: number;
  onSave: (data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number }) => Promise<void>;
  onClose: () => void;
}

function ReceiptSheet({ defaultDate, defaultHerRatio, onSave, onClose }: ReceiptSheetProps) {
  const [store, setStore] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [card, setCard] = useState<"mine" | "family">("mine");
  const [amount, setAmount] = useState("");
  const [herRatio, setHerRatio] = useState(defaultHerRatio);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      if (!resp.ok) throw new Error();
      const parsed = await resp.json();
      if (parsed.store) setStore(parsed.store);
      if (parsed.date) setDate(parsed.date);
      if (parsed.total) setAmount(String(parsed.total));
    } catch {
      setError("scan failed — enter manually");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (n <= 0) return;
    setSaving(true);
    setError("");
    try {
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout — check Supabase tables")), 10000)
      );
      await Promise.race([
        onSave({ date, store: store.trim() || "−", card, items: [{ name: RATIO_KEY, price: herRatio }], shared_amount: n }),
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
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground disabled:opacity-40"
        >
          <Camera size={13} />
          {scanning ? "scanning..." : "scan"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
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

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session, herRatio, onDelete, onUpdateStore }: {
  session: SplitSession;
  herRatio: number;
  onDelete: () => void;
  onUpdateStore: (store: string) => void;
}) {
  const [editingStore, setEditingStore] = useState(false);
  const [storeInput, setStoreInput] = useState(session.store === "−" ? "" : session.store);
  const gfOwed = Math.round(session.shared_amount * herRatio);
  const isCredit = session.card === "family";

  const saveStore = () => {
    const v = storeInput.trim() || "−";
    onUpdateStore(v);
    setEditingStore(false);
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editingStore ? (
            <input
              autoFocus
              type="text"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveStore(); if (e.key === "Escape") setEditingStore(false); }}
              onBlur={saveStore}
              placeholder="store name..."
              style={{ fontSize: "16px" }}
              className="flex-1 bg-transparent border-b border-border outline-none text-[13px] min-w-0"
            />
          ) : (
            <button onClick={() => setEditingStore(true)} className="text-left min-w-0 flex-1">
              <p className={cn(
                "text-[13px] tracking-wide truncate",
                (!session.store || session.store === "−") && "text-muted-foreground/50"
              )}>
                {(!session.store || session.store === "−") ? "tap to add name" : session.store}
              </p>
            </button>
          )}
          <span className={cn(
            "text-[9px] tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0",
            session.card === "mine" ? "border-border text-muted-foreground" : "border-blue-400/50 text-blue-500"
          )}>
            {session.card === "mine" ? "him" : "her"}
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[9px] text-muted-foreground tracking-wider">{isCredit ? "him owes" : "her owes"}</p>
        <p className={cn("text-[15px] tabular-nums", isCredit && "text-blue-500")}>{fmtYen(gfOwed)}</p>
      </div>
      <button onClick={onDelete} className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function SplitTab() {
  const { householdId } = useAuthStore();
  const {
    sessions, familyTotal, subscriptions, loading,
    load, addSession, deleteSession, setFamilyTotal,
    addSubscription, deleteSubscription, updateSessionStore,
  } = useSplitStore();

  // Closing day: 0 = calendar month, 1-28 = billing cycle closes on that day
  const [closingDay, setClosingDay] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("split_closing_day") ?? "0", 10);
  });
  const [editingClosingDay, setEditingClosingDay] = useState(false);
  const [closingDayInput, setClosingDayInput] = useState("");

  // Split ratio: her's share (0.0–1.0), default 0.5
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;
    return parseFloat(localStorage.getItem("split_ratio") ?? "0.5");
  });
  const [editingRatio, setEditingRatio] = useState(false);
  const [ratioInput, setRatioInput] = useState("");

  const saveRatio = () => {
    const pct = parseInt(ratioInput, 10);
    const valid = !isNaN(pct) && pct >= 0 && pct <= 100;
    const ratio = valid ? pct / 100 : splitRatio;
    setSplitRatio(ratio);
    localStorage.setItem("split_ratio", String(ratio));
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

  useEffect(() => {
    if (!householdId) return;
    load(householdId, period.from, period.to, viewYear, viewMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, viewYear, viewMonth, closingDay, load]);

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
    localStorage.setItem("split_closing_day", String(day));
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
  const totalMineShared = sessions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.shared_amount, 0) + subsMine;
  const totalFamilyShared = sessions.filter(s => s.card === "family").reduce((sum, s) => sum + s.shared_amount, 0) + subsFamily;
  const familyCardTotal = familyTotal?.total ?? 0;
  const gfOwesRaw = herFromMine + subsMine * splitRatio + familyCardTotal - herFromFamily - subsFamily * splitRatio;
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
            <p className="text-[12px] tabular-nums">{fmtYen(totalMineShared * splitRatio)}</p>
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
            <p className="text-[12px] text-blue-500 tabular-nums">−{fmtYen(totalFamilyShared * splitRatio)}</p>
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
                herRatio={splitRatio}
                onDelete={() => deleteSession(session.id)}
                onUpdateStore={(store) => updateSessionStore(session.id, store)}
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
              <span className={cn(
                "text-[9px] tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0",
                sub.card === "mine" ? "border-border/60 text-muted-foreground/60" : "border-blue-400/30 text-blue-400"
              )}>
                {sub.card === "mine" ? "him" : "her"}
              </span>
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
