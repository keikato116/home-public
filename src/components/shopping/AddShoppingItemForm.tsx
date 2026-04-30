"use client";

import { useState } from "react";
import { useShoppingStore } from "@/store/shoppingStore";
import { useAuthStore } from "@/store/authStore";
import { Plus } from "lucide-react";

const CATEGORIES = ["produce", "meat & fish", "dairy", "pantry", "drinks", "household", "other"];

export function AddShoppingItemForm() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const { addItem } = useShoppingStore();
  const { householdId } = useAuthStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !householdId) return;
    await addItem(householdId, label.trim(), category);
    setLabel("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <Plus size={12} />
        <span className="tracking-wider">add item</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 py-2">
      <input
        autoFocus
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="item name..."
        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`text-[10px] tracking-wider px-2 py-1 rounded border transition-colors ${
              category === cat
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={!label.trim()} className="text-[11px] tracking-wider disabled:opacity-40">
          add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">
          cancel
        </button>
      </div>
    </form>
  );
}
