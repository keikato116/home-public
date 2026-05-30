"use client";

import { useEffect, useState } from "react";
import { useShoppingStore } from "@/store/shoppingStore";
import { useAuthStore } from "@/store/authStore";
import { ShoppingItem } from "@/types";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTabDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

function ItemRow({ item, onDelete }: { item: ShoppingItem; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/10 group">
      <span className="text-[13px] tracking-wide flex-1">{item.label}</span>
      <button
        onClick={onDelete}
        className="text-[16px] leading-none text-muted-foreground/30 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity hover:text-muted-foreground px-1"
      >
        ×
      </button>
    </div>
  );
}

function AddItemForm({
  defaultDate,
  onAdd,
}: {
  defaultDate: string | null;
  onAdd: (label: string, date: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(label.trim(), defaultDate);
      setLabel("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-3"
      >
        <Plus size={12} />
        <span className="tracking-wider">add item</span>
      </button>
    );

  return (
    <form onSubmit={submit} className="py-3">
      <input
        autoFocus
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="item name..."
        className="w-full bg-transparent border-b border-border pb-1 text-[12px] focus:outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-3 mt-3">
        <button
          type="submit"
          disabled={!label.trim() || submitting}
          className="text-[11px] tracking-wider disabled:opacity-40"
        >
          {submitting ? "adding..." : "add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-muted-foreground"
        >
          cancel
        </button>
      </div>
    </form>
  );
}

export function ShoppingTab() {
  const { householdId } = useAuthStore();
  const { load, subscribeRealtime, items, deleteItem, addItem } = useShoppingStore();
  const today = todayStr();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  // Only today and future
  const visibleItems = items.filter((i) => !i.date || i.date >= today);

  // Sorted distinct future dates
  const dates = Array.from(new Set(visibleItems.filter((i) => i.date).map((i) => i.date!))).sort();

  const undatedItems = visibleItems.filter((i) => !i.date);

  // Active tab: use stored value if still valid, else first date
  const firstDate = dates[0] ?? null;
  const effectiveTab = activeTab && dates.includes(activeTab) ? activeTab : firstDate;

  // Items to display for active tab
  // First tab also includes undated items
  const tabItems =
    effectiveTab === firstDate
      ? [...undatedItems, ...visibleItems.filter((i) => i.date === effectiveTab)]
      : visibleItems.filter((i) => i.date === effectiveTab);

  // If no dated items at all, just show undated
  const displayItems = dates.length === 0 ? undatedItems : tabItems;

  const hasTabs = dates.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {hasTabs && (
        <div className="flex border-b border-border/20 overflow-x-auto px-5 pt-10 flex-shrink-0">
          {dates.map((date) => (
            <button
              key={date}
              onClick={() => setActiveTab(date)}
              className={cn(
                "text-[10px] tracking-wider px-3 py-2 whitespace-nowrap border-b-2 -mb-px transition-colors",
                effectiveTab === date
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground"
              )}
            >
              {formatTabDate(date)}
            </button>
          ))}
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto px-7 pb-8", hasTabs ? "pt-6" : "pt-16")}>
        {displayItems.length === 0 && (
          <p className="text-[11px] text-muted-foreground py-3">nothing here</p>
        )}
        {displayItems.map((item) => (
          <ItemRow key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
        ))}
        <AddItemForm
          defaultDate={effectiveTab}
          onAdd={async (label, date) => {
            if (!householdId) return;
            await addItem(householdId, label, "other", date ?? undefined);
          }}
        />
      </div>
    </div>
  );
}
