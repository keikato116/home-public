"use client";

import { useState } from "react";
import { SplitUtility } from "@/types";
import { Plus, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtYen, inputStyle } from "./lib";

// Fixed costs whose amount changes month to month (phone, electricity, gas, water...).
// Rendered outside the scrolling receipt list so they're always visible.
export function UtilitiesSection({ utilities, amounts, onSetAmount, onAdd, onDelete, onUpdateCard }: {
  utilities: SplitUtility[];
  amounts: Record<string, number>;
  onSetAmount: (utilityId: string, amount: number | null) => void;
  onAdd: (name: string) => Promise<void>;
  onDelete: (utilityId: string) => void;
  onUpdateCard: (utilityId: string, card: "mine" | "family") => void;
}) {
  const [adding, setAdding] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");

  const total = utilities.reduce((sum, u) => sum + (amounts[u.id] ?? 0), 0);

  const handleAdd = async () => {
    const name = nameInput.trim();
    if (!name) return;
    await onAdd(name);
    setNameInput("");
    setAdding(false);
  };

  const startEdit = (u: SplitUtility) => {
    setAmountInput(amounts[u.id] !== undefined ? String(amounts[u.id]) : "");
    setEditingId(u.id);
  };

  const saveAmount = () => {
    if (!editingId) return;
    const raw = amountInput.trim();
    const n = parseInt(raw, 10);
    if (raw === "") onSetAmount(editingId, null);
    else if (!isNaN(n) && n >= 0) onSetAmount(editingId, n);
    setEditingId(null);
  };

  return (
    <div className="mx-6 mb-3 pb-2 border-b border-border/20">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Zap size={10} className="text-muted-foreground/60" />
          <p className="text-[9px] tracking-widest text-muted-foreground/60 uppercase">fixed costs</p>
          {total > 0 && <span className="text-[9px] tabular-nums text-muted-foreground/60">· {fmtYen(total)}</span>}
        </div>
        <button onClick={() => setAdding(!adding)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-1">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            placeholder="name..."
            autoFocus
            style={inputStyle}
            className="flex-1 bg-transparent border-b border-border py-1 outline-none placeholder:text-muted-foreground"
          />
          <button onClick={handleAdd} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <Plus size={15} />
          </button>
        </div>
      )}

      {utilities.length === 0 && !adding && (
        <p className="text-[10px] text-muted-foreground/40">no fixed costs</p>
      )}

      <div className="max-h-40 overflow-y-auto">
        {utilities.map((u) => {
          const amount = amounts[u.id];
          return (
            <div key={u.id} className="flex items-center gap-2 py-1 border-b border-border/10 last:border-b-0">
              <span className="flex-1 text-[12px] text-muted-foreground truncate">{u.name}</span>
              {editingId === u.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">¥</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveAmount(); if (e.key === "Escape") setEditingId(null); }}
                    onBlur={saveAmount}
                    style={inputStyle}
                    className="w-20 bg-transparent text-right outline-none border-b border-border"
                  />
                </div>
              ) : (
                <button onClick={() => startEdit(u)} className="text-[12px] tabular-nums min-w-[60px] text-right">
                  {amount !== undefined ? fmtYen(amount) : <span className="text-muted-foreground/40">未入力</span>}
                </button>
              )}
              <button
                onClick={() => onUpdateCard(u.id, u.card === "mine" ? "family" : "mine")}
                className={cn(
                  "text-[9px] tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors",
                  u.card === "mine" ? "border-border/60 text-muted-foreground/60" : "border-blue-400/30 text-blue-400"
                )}
                aria-label="toggle him/her"
              >
                {u.card === "mine" ? "him" : "her"}
              </button>
              <button
                onClick={() => { if (window.confirm(`「${u.name}」を削除しますか？（全ての月の金額も消えます）`)) onDelete(u.id); }}
                className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
