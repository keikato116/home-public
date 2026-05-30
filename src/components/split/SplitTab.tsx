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

// ─── Receipt / Item Entry Sheet ───────────────────────────────────────────────

interface ReceiptSheetProps {
  defaultDate: string;
  onSave: (data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number }) => Promise<void>;
  onClose: () => void;
}

function ReceiptSheet({ defaultDate, onSave, onClose }: ReceiptSheetProps) {
  const [store, setStore] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [card, setCard] = useState<"mine" | "family">("mine");
  const [items, setItems] = useState<SplitItem[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleCheck = (i: number) => setChecked((prev) => prev.map((v, idx) => idx === i ? !v : v));
  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setChecked((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    const price = parseInt(newPrice, 10);
    if (!newName.trim() || !price || price <= 0) return;
    setItems((prev) => [...prev, { name: newName.trim(), price }]);
    setChecked((prev) => [...prev, true]);
    setNewName("");
    setNewPrice("");
  };

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
      if (parsed.items?.length) {
        setItems(parsed.items);
        setChecked(parsed.items.map(() => true));
      }
    } catch {
      setError("scan failed — enter manually");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const checkedTotal = items.reduce((sum, item, i) => sum + (checked[i] ? item.price : 0), 0);
  const gfOwed = Math.round(checkedTotal / 2);

  const handleSave = async () => {
    if (items.length === 0 || checkedTotal === 0) return;
    setSaving(true);
    setError("");
    try {
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout — check Supabase tables")), 10000)
      );
      await Promise.race([
        onSave({ date, store: store || "−", card, items, shared_amount: checkedTotal }),
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-border/30">
        <button onClick={onClose} className="text-muted-foreground p-1">
          <X size={16} />
        </button>
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase">add receipt</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <Camera size={13} />
          {scanning ? "scanning..." : "scan"}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Store */}
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="store name..."
          style={inputStyle}
          className="w-full bg-muted/40 rounded-xl px-4 py-3 outline-none placeholder:text-muted-foreground"
        />

        {/* Date + card in one row */}
        <div className="flex gap-2 items-stretch">
          {/* Date — hidden native input behind a styled button */}
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
          {/* Card selector */}
          <div className="flex gap-2 flex-1">
            {(["mine", "family"] as const).map((v) => (
              <button key={v} onClick={() => setCard(v)}
                className={cn(
                  "flex-1 text-[12px] tracking-wide rounded-xl border py-2.5 transition-colors",
                  card === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}>
                {v === "mine" ? "my card" : "family"}
              </button>
            ))}
          </div>
        </div>

        {/* Item checklist */}
        <div>
          <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-2">
            items — uncheck personal purchases
          </p>
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/20">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggleCheck(i)}
                  className="w-4 h-4 accent-foreground flex-shrink-0 cursor-pointer"
                />
                <span className={cn("flex-1 text-[14px]", !checked[i] && "text-muted-foreground line-through")}>
                  {item.name}
                </span>
                <span className={cn("text-[14px] flex-shrink-0 tabular-nums", !checked[i] && "text-muted-foreground")}>
                  ¥{item.price.toLocaleString()}
                </span>
                <button onClick={() => removeItem(i)} className="text-muted-foreground/40 hover:text-muted-foreground">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add item row */}
          <div className="flex items-center gap-2 mt-3 pt-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder="item name..."
              style={inputStyle}
              className="flex-1 bg-transparent border-b border-border py-2 outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1 border-b border-border">
              <span className="text-muted-foreground">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                placeholder="0"
                style={inputStyle}
                className="w-20 bg-transparent py-2 outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button onClick={addItem} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <Plus size={15} />
            </button>
          </div>
        </div>

        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-4 border-t border-border/30 space-y-3 bg-background"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">shared total</p>
            <p className="text-[22px] font-light tabular-nums">{fmtYen(checkedTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
              {card === "mine" ? "girlfriend owes" : "you owe (credit)"}
            </p>
            <p className="text-[22px] font-light tabular-nums">{fmtYen(gfOwed)}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || checkedTotal === 0}
          className="w-full bg-foreground text-background rounded-xl py-3.5 text-[13px] tracking-wider disabled:opacity-40"
        >
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </div>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session, onDelete }: { session: SplitSession; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const gfOwed = Math.round(session.shared_amount / 2);
  const isCredit = session.card === "family";

  return (
    <div className="border-b border-border/20">
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] tracking-wide truncate">{session.store}</p>
            <span className={cn(
              "text-[9px] tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0",
              session.card === "mine" ? "border-border text-muted-foreground" : "border-blue-400/50 text-blue-500"
            )}>
              {session.card === "mine" ? "my" : "family"}
            </span>
          </div>
          <button onClick={() => setOpen(!open)} className="text-[10px] text-muted-foreground mt-0.5 text-left">
            {session.items.length} items · shared {fmtYen(session.shared_amount)}
          </button>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[9px] text-muted-foreground tracking-wider">{isCredit ? "your credit" : "gf owes"}</p>
          <p className={cn("text-[15px] tabular-nums", isCredit && "text-blue-500")}>{fmtYen(gfOwed)}</p>
        </div>
        <button onClick={onDelete} className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0">
          <X size={14} />
        </button>
      </div>
      {open && (
        <div className="pb-3 pl-2 space-y-0.5">
          {session.items.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px] text-muted-foreground py-0.5">
              <span>{item.name}</span>
              <span className="tabular-nums">¥{item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function SplitTab() {
  const { householdId } = useAuthStore();
  const {
    sessions, familyTotal, subscriptions, loading,
    load, addSession, deleteSession, setFamilyTotal,
    addSubscription, deleteSubscription,
  } = useSplitStore();

  // Closing day: 0 = calendar month, 1-28 = billing cycle closes on that day
  const [closingDay, setClosingDay] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("split_closing_day") ?? "0", 10);
  });
  const [editingClosingDay, setEditingClosingDay] = useState(false);
  const [closingDayInput, setClosingDayInput] = useState("");

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
  const mineShared = sessions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.shared_amount, 0);
  const familyShared = sessions.filter(s => s.card === "family").reduce((sum, s) => sum + s.shared_amount, 0);
  const subsMine = subscriptions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.amount, 0);
  const subsFamily = subscriptions.filter(s => s.card === "family").reduce((sum, s) => sum + s.amount, 0);
  const totalMineShared = mineShared + subsMine;
  const totalFamilyShared = familyShared + subsFamily;
  const familyCardTotal = familyTotal?.total ?? 0;
  const gfOwesRaw = totalMineShared / 2 + familyCardTotal - totalFamilyShared / 2;
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

      {/* Closing day setting */}
      <div className="px-6 pb-3 flex items-center justify-end gap-1.5">
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

      {/* Summary card */}
      <div className="mx-6 mb-3 bg-muted/40 rounded-2xl px-5 py-4 space-y-3">
        <div>
          <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1">
            {netPositive ? "girlfriend owes" : "you owe"}
          </p>
          <p className={cn("text-[38px] font-light tracking-tight tabular-nums", !netPositive && "text-blue-500")}>
            {fmtYen(gfOwesRaw)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border/20">
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">my card splits</p>
            <p className="text-[12px] tabular-nums">{fmtYen(totalMineShared / 2)}</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">family card bill</p>
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
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">family splits (−)</p>
            <p className="text-[12px] text-blue-500 tabular-nums">−{fmtYen(totalFamilyShared / 2)}</p>
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
                onDelete={() => deleteSession(session.id)}
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
                  {subCard === "mine" ? "my card" : "family"}
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
                {sub.card === "mine" ? "my" : "family"}
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
          onSave={(data) => addSession(householdId!, data)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
