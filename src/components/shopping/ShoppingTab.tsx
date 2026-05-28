"use client";

import { useEffect } from "react";
import { useShoppingStore } from "@/store/shoppingStore";
import { useAuthStore } from "@/store/authStore";
import { ShoppingItem } from "@/types";
import { useShoppingStore as _useShoppingStore } from "@/store/shoppingStore";
import { cn } from "@/lib/utils";

const FOOD_CATS = new Set(["produce", "meat & fish", "dairy", "pantry", "drinks"]);

function ItemRow({ item }: { item: ShoppingItem }) {
  const { toggleItem, deleteItem } = _useShoppingStore();
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border group">
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => toggleItem(item.id, !item.done)}
        className="w-3.5 h-3.5 accent-foreground cursor-pointer"
      />
      <span className={cn("text-[12px] tracking-wide flex-1", item.done && "line-through text-muted-foreground")}>
        {item.label}
      </span>
      <button
        onClick={() => deleteItem(item.id)}
        className="text-[14px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity hover:text-muted-foreground"
      >
        ×
      </button>
    </div>
  );
}

export function ShoppingTab() {
  const { householdId } = useAuthStore();
  const { load, subscribeRealtime, items, clearDone } = useShoppingStore();

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  const hasDone = items.some((i) => i.done);

  // Split food vs household
  const foodItems = items.filter((i) => FOOD_CATS.has(i.category));
  const otherItems = items.filter((i) => !FOOD_CATS.has(i.category));

  // Food: group by date (sorted ascending), null-date last
  const foodByDate: Record<string, ShoppingItem[]> = {};
  for (const item of foodItems) {
    const key = item.date ?? "__nodate__";
    if (!foodByDate[key]) foodByDate[key] = [];
    foodByDate[key].push(item);
  }
  const dateSections: [string | null, ShoppingItem[]][] = [
    ...Object.keys(foodByDate)
      .filter((k) => k !== "__nodate__")
      .sort()
      .map((k) => [k, foodByDate[k]] as [string, ShoppingItem[]]),
    ...(foodByDate["__nodate__"] ? [[null, foodByDate["__nodate__"]] as [null, ShoppingItem[]]] : []),
  ];

  // Household: group by category
  const householdByCategory: Record<string, ShoppingItem[]> = {};
  for (const item of otherItems) {
    if (!householdByCategory[item.category]) householdByCategory[item.category] = [];
    householdByCategory[item.category].push(item);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  }

  return (
    <div className="flex flex-col h-full px-7 py-8">
      <div className="flex items-center justify-between mb-8">
        <div />
        {hasDone && (
          <button
            onClick={() => householdId && clearDone(householdId)}
            className="text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            clear done
          </button>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* Food items grouped by date */}
        {dateSections.map(([date, sectionItems]) => (
          <div key={date ?? "no-date"}>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              {date ? formatDate(date) : "food"}
            </p>
            {(sectionItems as ShoppingItem[]).map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        ))}

        {/* Household items grouped by category */}
        {Object.entries(householdByCategory).map(([cat, catItems]) => (
          <div key={cat}>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">{cat}</p>
            {catItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        ))}

        <AddShoppingItemInline />
      </div>
    </div>
  );
}

const ADD_CATEGORIES = ["produce", "meat & fish", "dairy", "pantry", "drinks", "household", "other"];

function AddShoppingItemInline() {
  const { addItem } = useShoppingStore();
  const { householdId, loading: authLoading } = useAuthStore();

  return (
    <AddForm
      onSubmit={async (label, category) => {
        if (!householdId) return;
        await addItem(householdId, label, category);
      }}
      authLoading={authLoading}
    />
  );
}

import { useState } from "react";
import { Plus } from "lucide-react";

function AddForm({ onSubmit, authLoading }: { onSubmit: (label: string, category: string) => Promise<void>; authLoading: boolean }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(label.trim(), category);
      setLabel("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2">
      <Plus size={12} />
      <span className="tracking-wider">add item</span>
    </button>
  );

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
        {ADD_CATEGORIES.map((cat) => (
          <button key={cat} type="button" onClick={() => setCategory(cat)}
            className={`text-[10px] tracking-wider px-2 py-1 rounded border transition-colors ${category === cat ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
            {cat}
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={!label.trim() || submitting || authLoading} className="text-[11px] tracking-wider disabled:opacity-40">
          {submitting ? "adding..." : "add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">cancel</button>
      </div>
    </form>
  );
}
