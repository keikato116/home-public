"use client";

import { useEffect, useRef, useState } from "react";
import { useSplitStore } from "@/store/splitStore";
import { useAuthStore } from "@/store/authStore";
import { SplitEntry } from "@/types";
import { ChevronLeft, ChevronRight, Camera, Plus, X } from "lucide-react";
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

function computeOwed(entries: SplitEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.split_type === "shared" ? e.amount / 2 : e.amount), 0);
}

function fmtYen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

// ─── Add Entry Sheet ─────────────────────────────────────────────────────────

interface AddSheetProps {
  defaultDate: string;
  onSave: (data: Omit<SplitEntry, "id" | "household_id" | "created_at">) => Promise<void>;
  onClose: () => void;
}

function AddSheet({ defaultDate, onSave, onClose }: AddSheetProps) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [paidBy, setPaidBy] = useState<"mine" | "family">("mine");
  const [splitType, setSplitType] = useState<"shared" | "hers">("shared");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (!resp.ok) throw new Error("scan failed");
      const parsed = await resp.json();
      if (parsed.description) setDescription(parsed.description);
      if (parsed.amount) setAmountStr(String(parsed.amount));
      if (parsed.date) setDate(parsed.date);
    } catch {
      setError("receipt scan failed — enter manually");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const amount = parseInt(amountStr, 10);
    if (!description.trim() || !amount || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        date,
        description: description.trim(),
        amount,
        paid_by: paidBy,
        split_type: paidBy === "mine" ? "shared" : splitType,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const canSave = description.trim().length > 0 && parseInt(amountStr, 10) > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl px-6 pt-5 pb-8 space-y-4"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] tracking-widest text-muted-foreground uppercase">add expense</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wider disabled:opacity-40"
            >
              <Camera size={12} />
              {scanning ? "scanning..." : "scan receipt"}
            </button>
            <button onClick={onClose}><X size={14} className="text-muted-foreground" /></button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />

        {/* Description */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="store / item..."
          className="w-full bg-muted/40 rounded-lg px-3 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground"
        />

        {/* Amount + Date */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-2.5 flex-1">
            <span className="text-[13px] text-muted-foreground">¥</span>
            <input
              type="number"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="bg-transparent flex-1 text-[13px] outline-none min-w-0 placeholder:text-muted-foreground"
            />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-muted/40 rounded-lg px-3 py-2.5 text-[12px] outline-none text-foreground"
          />
        </div>

        {/* Paid by */}
        <div className="space-y-2">
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">paid with</p>
          <div className="flex gap-2">
            {(["mine", "family"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setPaidBy(v); if (v === "mine") setSplitType("shared"); }}
                className={cn(
                  "flex-1 text-[11px] tracking-wider rounded border py-2 transition-colors",
                  paidBy === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}
              >
                {v === "mine" ? "my card" : "family card"}
              </button>
            ))}
          </div>
        </div>

        {/* Split type — only show for family card */}
        {paidBy === "family" && (
          <div className="space-y-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">type</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSplitType("shared")}
                className={cn(
                  "flex-1 text-[11px] tracking-wider rounded border py-2 transition-colors",
                  splitType === "shared" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}
              >
                shared 50/50
              </button>
              <button
                onClick={() => setSplitType("hers")}
                className={cn(
                  "flex-1 text-[11px] tracking-wider rounded border py-2 transition-colors",
                  splitType === "hers" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"
                )}
              >
                hers 100%
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-[10px] text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="bg-foreground text-background rounded px-5 py-2 text-[12px] tracking-wider disabled:opacity-40"
        >
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function SplitTab() {
  const { householdId } = useAuthStore();
  const { entries, loading, load, addEntry, deleteEntry } = useSplitStore();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    load(householdId, viewYear, viewMonth);
  }, [householdId, viewYear, viewMonth, load]);

  const goMonth = (dir: number) => {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const totalOwed = computeOwed(entries);
  const sharedTotal = entries.filter(e => e.split_type === "shared").reduce((s, e) => s + e.amount, 0);
  const hersTotal = entries.filter(e => e.split_type === "hers").reduce((s, e) => s + e.amount, 0);

  // Group by date
  const byDate: Record<string, SplitEntry[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const defaultDate = toDateStr(new Date(viewYear, viewMonth, Math.min(today.getDate(), new Date(viewYear, viewMonth + 1, 0).getDate())));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-5 pt-10 pb-3 flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="text-muted-foreground p-1">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[12px] tracking-[0.2em] text-foreground">
          {MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}
        </p>
        <button onClick={() => goMonth(1)} className="text-muted-foreground p-1">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Summary card */}
      <div className="mx-5 mb-4 bg-muted/40 rounded-2xl px-5 py-4 space-y-2">
        <p className="text-[9px] tracking-[0.3em] text-muted-foreground uppercase">girlfriend owes</p>
        <p className="text-[32px] font-light tracking-tight">{fmtYen(totalOwed)}</p>
        {entries.length > 0 && (
          <div className="flex gap-4 pt-1">
            {sharedTotal > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground tracking-wider">shared</p>
                <p className="text-[11px]">{fmtYen(sharedTotal)} × ½ = {fmtYen(sharedTotal / 2)}</p>
              </div>
            )}
            {hersTotal > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground tracking-wider">hers</p>
                <p className="text-[11px]">{fmtYen(hersTotal)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        {loading && <p className="text-[10px] text-muted-foreground text-center py-4">loading...</p>}
        {!loading && dates.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-8">no entries this month</p>
        )}
        {dates.map((date) => (
          <div key={date}>
            <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-2">
              {formatDateHeader(date)}
            </p>
            <div className="space-y-1">
              {byDate[date].map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] tracking-wide truncate">{entry.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        "text-[9px] tracking-wider px-1.5 py-0.5 rounded border",
                        entry.paid_by === "mine"
                          ? "border-border text-muted-foreground"
                          : "border-blue-400/50 text-blue-500"
                      )}>
                        {entry.paid_by === "mine" ? "my card" : "family"}
                      </span>
                      <span className={cn(
                        "text-[9px] tracking-wider px-1.5 py-0.5 rounded border",
                        entry.split_type === "shared"
                          ? "border-green-400/50 text-green-600"
                          : "border-orange-400/50 text-orange-500"
                      )}>
                        {entry.split_type === "shared" ? "50/50" : "hers"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px]">{fmtYen(entry.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      → {fmtYen(entry.split_type === "shared" ? entry.amount / 2 : entry.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0 text-[16px] leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add button */}
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <Plus size={12} />
          <span className="tracking-wider">add entry</span>
        </button>
      </div>

      {addOpen && (
        <AddSheet
          defaultDate={defaultDate}
          onSave={(data) => addEntry(householdId!, data)}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
