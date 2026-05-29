"use client";

import { useEffect, useRef, useState } from "react";
import { useSplitStore } from "@/store/splitStore";
import { useAuthStore } from "@/store/authStore";
import { SplitItem, SplitSession } from "@/types";
import { ChevronLeft, ChevronRight, Camera, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}
function fmtYen(n: number) {
  return `¥${Math.round(Math.abs(n)).toLocaleString()}`;
}

// ─── Receipt / Item Entry Sheet ───────────────────────────────────────────────

interface ReceiptSheetProps {
  defaultDate: string;
  initialStore?: string;
  initialDate?: string;
  initialItems?: SplitItem[];
  onSave: (data: { date: string; store: string; card: "mine" | "family"; items: SplitItem[]; shared_amount: number }) => Promise<void>;
  onClose: () => void;
}

function ReceiptSheet({ defaultDate, initialStore = "", initialDate, initialItems, onSave, onClose }: ReceiptSheetProps) {
  const [store, setStore] = useState(initialStore);
  const [date, setDate] = useState(initialDate ?? defaultDate);
  const [card, setCard] = useState<"mine" | "family">("mine");
  const [items, setItems] = useState<SplitItem[]>(initialItems ?? []);
  const [checked, setChecked] = useState<boolean[]>((initialItems ?? []).map(() => true));
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleCheck = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => idx === i ? !v : v));
  };

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
      await onSave({ date, store: store || "−", card, items, shared_amount: checkedTotal });
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
      <div className="flex items-center justify-between px-6 pt-10 pb-4 border-b border-border/30">
        <button onClick={onClose} className="text-muted-foreground">
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

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Store + date + card */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="store name..."
              className="flex-1 bg-muted/40 rounded-lg px-3 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-muted/40 rounded-lg px-3 py-2.5 text-[12px] outline-none"
            />
          </div>
          {/* Card selector */}
          <div className="flex gap-2">
            {(["mine", "family"] as const).map((v) => (
              <button key={v} onClick={() => setCard(v)}
                className={cn(
                  "flex-1 text-[11px] tracking-wider rounded border py-2 transition-colors",
                  card === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}>
                {v === "mine" ? "my card" : "family card"}
              </button>
            ))}
          </div>
        </div>

        {/* Item checklist */}
        <div>
          <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-2">
            items — uncheck personal purchases
          </p>
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/20">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggleCheck(i)}
                  className="w-4 h-4 accent-foreground flex-shrink-0 cursor-pointer"
                />
                <span className={cn("flex-1 text-[13px]", !checked[i] && "text-muted-foreground line-through")}>{item.name}</span>
                <span className={cn("text-[13px] flex-shrink-0", !checked[i] && "text-muted-foreground")}>¥{item.price.toLocaleString()}</span>
                <button onClick={() => removeItem(i)} className="text-muted-foreground/40 hover:text-muted-foreground text-[14px]">×</button>
              </div>
            ))}
          </div>

          {/* Add item row */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder="item name..."
              className="flex-1 bg-transparent border-b border-border text-[12px] py-1 outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1 border-b border-border">
              <span className="text-[12px] text-muted-foreground">¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                placeholder="0"
                className="w-16 bg-transparent text-[12px] py-1 outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button onClick={addItem} className="text-muted-foreground hover:text-foreground transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>

      {/* Footer summary + save */}
      <div
        className="px-6 py-4 border-t border-border/30 space-y-3 bg-background"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">shared total</p>
            <p className="text-[20px] font-light">{fmtYen(checkedTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
              {card === "mine" ? "girlfriend owes" : "you owe (credit)"}
            </p>
            <p className="text-[20px] font-light">{fmtYen(gfOwed)}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || checkedTotal === 0}
          className="w-full bg-foreground text-background rounded-lg py-3 text-[12px] tracking-wider disabled:opacity-40"
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
      <div className="flex items-center gap-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] tracking-wide truncate">{session.store}</p>
            <span className={cn(
              "text-[9px] tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0",
              session.card === "mine" ? "border-border text-muted-foreground" : "border-blue-400/50 text-blue-500"
            )}>
              {session.card === "mine" ? "my card" : "family"}
            </span>
          </div>
          <button onClick={() => setOpen(!open)} className="text-[10px] text-muted-foreground mt-0.5">
            {session.items.length} items · shared {fmtYen(session.shared_amount)}
          </button>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[9px] text-muted-foreground tracking-wider">{isCredit ? "your credit" : "gf owes"}</p>
          <p className={cn("text-[14px]", isCredit && "text-blue-500")}>{fmtYen(gfOwed)}</p>
        </div>
        <button onClick={onDelete} className="text-muted-foreground/40 hover:text-muted-foreground text-[16px] leading-none flex-shrink-0">×</button>
      </div>
      {open && (
        <div className="pb-2 pl-1 space-y-0.5">
          {session.items.map((item, i) => (
            <div key={i} className="flex justify-between text-[11px] text-muted-foreground py-0.5">
              <span>{item.name}</span>
              <span>¥{item.price.toLocaleString()}</span>
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
  const { sessions, familyTotal, loading, load, addSession, deleteSession, setFamilyTotal } = useSplitStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyInput, setFamilyInput] = useState("");

  useEffect(() => {
    if (!householdId) return;
    load(householdId, viewYear, viewMonth);
  }, [householdId, viewYear, viewMonth, load]);

  useEffect(() => {
    setFamilyInput(familyTotal ? String(familyTotal.total) : "");
  }, [familyTotal]);

  const goMonth = (dir: number) => {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Settlement calculation
  const mineShared = sessions.filter(s => s.card === "mine").reduce((sum, s) => sum + s.shared_amount, 0);
  const familyShared = sessions.filter(s => s.card === "family").reduce((sum, s) => sum + s.shared_amount, 0);
  const familyCardTotal = familyTotal?.total ?? 0;

  // girlfriend owes = (my card shared / 2) + family card total - (family card shared / 2)
  const gfOwesRaw = mineShared / 2 + familyCardTotal - familyShared / 2;
  const netPositive = gfOwesRaw >= 0;

  // Group sessions by date
  const byDate: Record<string, SplitSession[]> = {};
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const defaultDate = toDateStr(new Date(viewYear, viewMonth, Math.min(today.getDate(), new Date(viewYear, viewMonth + 1, 0).getDate())));

  const handleSaveFamilyTotal = async () => {
    if (!householdId) return;
    const n = parseInt(familyInput, 10);
    if (isNaN(n) || n < 0) return;
    await setFamilyTotal(householdId, viewYear, viewMonth, n);
    setEditingFamily(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Month navigation */}
      <div className="px-5 pt-10 pb-3 flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="text-muted-foreground p-1"><ChevronLeft size={16} /></button>
        <p className="text-[12px] tracking-[0.2em]">{MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}</p>
        <button onClick={() => goMonth(1)} className="text-muted-foreground p-1"><ChevronRight size={16} /></button>
      </div>

      {/* Summary card */}
      <div className="mx-5 mb-3 bg-muted/40 rounded-2xl px-5 py-4 space-y-3">
        <div>
          <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase mb-1">
            {netPositive ? "girlfriend owes" : "you owe"}
          </p>
          <p className={cn("text-[36px] font-light tracking-tight", !netPositive && "text-blue-500")}>
            {fmtYen(gfOwesRaw)}
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-border/20">
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">my card splits</p>
            <p className="text-[11px]">{fmtYen(mineShared / 2)}</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">family card bill</p>
            {editingFamily ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-[10px]">¥</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  value={familyInput}
                  onChange={(e) => setFamilyInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveFamilyTotal(); if (e.key === "Escape") setEditingFamily(false); }}
                  onBlur={handleSaveFamilyTotal}
                  className="w-16 bg-transparent text-[11px] text-center outline-none border-b border-border"
                />
              </div>
            ) : (
              <button onClick={() => setEditingFamily(true)} className="flex items-center gap-1 mx-auto">
                <span className="text-[11px]">{familyCardTotal > 0 ? fmtYen(familyCardTotal) : "−"}</span>
                <Pencil size={9} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground tracking-wider mb-0.5">family splits (−)</p>
            <p className="text-[11px] text-blue-500">−{fmtYen(familyShared / 2)}</p>
          </div>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
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

        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2 mt-2"
        >
          <Plus size={12} />
          <span className="tracking-wider">add receipt</span>
        </button>
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
