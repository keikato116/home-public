"use client";

import { useState } from "react";
import { SplitSession } from "@/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtYen } from "./lib";

export function SessionRow({ session, herRatio, onDelete, onUpdateStore, onUpdateCard }: {
  session: SplitSession;
  herRatio: number;
  onDelete: () => void;
  onUpdateStore: (store: string) => void;
  onUpdateCard: (card: "mine" | "family") => void;
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
          <button
            onClick={() => onUpdateCard(session.card === "mine" ? "family" : "mine")}
            className={cn(
              "text-[9px] tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors",
              session.card === "mine" ? "border-border text-muted-foreground" : "border-blue-400/50 text-blue-500"
            )}
            aria-label="toggle him/her"
          >
            {session.card === "mine" ? "him" : "her"}
          </button>
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
