"use client";

import { useEffect, useState } from "react";
import { useShoppingStore } from "@/store/shoppingStore";
import { useAuthStore } from "@/store/authStore";
import { Lock } from "lucide-react";
import { ShoppingItem } from "@/types";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const STORES = ["grocery", "pharmacy", "100yen", "muji", "amazon"] as const;
type Store = typeof STORES[number];

// "other" = auto-added from meal plan → shown under スーパー, no checkbox
// store name = manually added → shown under that store, with checkbox
// "list" = manually added with no category → shown under "my list", with checkbox
function getStore(item: ShoppingItem): Store {
  if ((STORES as readonly string[]).includes(item.category)) return item.category as Store;
  return "grocery";
}

function isManual(item: ShoppingItem): boolean {
  return (STORES as readonly string[]).includes(item.category) || item.category === "list";
}

function isList(item: ShoppingItem): boolean {
  return item.category === "list";
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTabDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

function ItemRow({ item, onDelete }: { item: ShoppingItem; onDelete: () => void }) {
  const manual = isManual(item);
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {manual && (
        <input
          type="checkbox"
          onChange={onDelete}
          className="w-3.5 h-3.5 accent-foreground cursor-pointer flex-shrink-0"
        />
      )}
      <span className="text-[13px] tracking-wide flex-1">{item.label}</span>
      {!manual && (
        <button
          onClick={onDelete}
          className="text-[16px] leading-none text-muted-foreground/30 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity hover:text-muted-foreground px-1"
        >
          ×
        </button>
      )}
    </div>
  );
}

function StoreSection({
  store,
  items,
  onDelete,
}: {
  store: Store;
  items: ShoppingItem[];
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-[10px] tracking-widest text-muted-foreground mb-1">{store}</p>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onDelete={() => onDelete(item.id)} />
      ))}
    </div>
  );
}

function AddItemForm({
  defaultDate,
  onAdd,
}: {
  defaultDate: string | null;
  onAdd: (label: string, store: Store | null, date: string | null, isPrivate: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(label.trim(), store, defaultDate, isPrivate);
      setLabel("");
      setStore(null);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-3 mt-2"
      >
        <Plus size={12} />
        <span className="tracking-wider">add item</span>
      </button>
    );

  return (
    <form onSubmit={submit} className="py-3 mt-2">
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
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          type="button"
          onClick={() => setStore(null)}
          className={cn(
            "text-[10px] tracking-wider px-2 py-1 rounded border transition-colors",
            store === null
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          my list
        </button>
        {STORES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStore(s)}
            className={cn(
              "text-[10px] tracking-wider px-2 py-1 rounded border transition-colors",
              store === s
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
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
        <button
          type="button"
          onClick={() => setIsPrivate(v => !v)}
          className={cn(
            "ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
            isPrivate
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          <Lock size={9} />
          mine only
        </button>
      </div>
    </form>
  );
}

export function ShoppingTab() {
  const { householdId, user } = useAuthStore();
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

  // Separate private (mine) vs shared
  const sharedVisible = visibleItems.filter((i) => !i.user_id);
  const privateVisible = visibleItems.filter((i) => i.user_id === user?.id);

  // Sorted distinct future dates (shared only, for tabs)
  const dates = Array.from(new Set(sharedVisible.filter((i) => i.date).map((i) => i.date!))).sort();

  const undatedItems = sharedVisible.filter((i) => !i.date);

  const firstDate = dates[0] ?? null;
  const effectiveTab = activeTab && dates.includes(activeTab) ? activeTab : firstDate;

  const tabItems =
    effectiveTab === firstDate
      ? [...undatedItems, ...sharedVisible.filter((i) => i.date === effectiveTab)]
      : sharedVisible.filter((i) => i.date === effectiveTab);

  const displayItems = dates.length === 0 ? undatedItems : tabItems;

  // Split: auto-added (meal plan, flat) / "my list" (no category) / store-grouped
  const autoItems = displayItems.filter((i) => !isManual(i));
  const listItems = displayItems.filter((i) => isList(i));
  const storeItems = displayItems.filter((i) => isManual(i) && !isList(i));

  const byStore: Record<Store, ShoppingItem[]> = {
    grocery: [],
    pharmacy: [],
    "100yen": [],
    muji: [],
    amazon: [],
  };
  for (const item of storeItems) {
    byStore[getStore(item)].push(item);
  }

  const hasTabs = dates.length > 0;
  const isEmpty = displayItems.length === 0 && privateVisible.length === 0;

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
        {isEmpty && (
          <p className="text-[11px] text-muted-foreground py-3">nothing here</p>
        )}
        {/* Auto-added items: flat list, no store header */}
        {autoItems.map((item) => (
          <ItemRow key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
        ))}
        {/* my list: no category selected */}
        {listItems.length > 0 && (
          <div className={autoItems.length > 0 ? "mt-4" : ""}>
            <p className="text-[10px] tracking-widest text-muted-foreground mb-1">my list</p>
            {listItems.map((item) => (
              <ItemRow key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
            ))}
          </div>
        )}
        {/* Manual items: grouped by store */}
        {(autoItems.length > 0 || listItems.length > 0) && storeItems.length > 0 && (
          <div className="border-t border-border/20 mt-4 mb-1" />
        )}
        {STORES.map((store) => (
          <StoreSection
            key={store}
            store={store}
            items={byStore[store]}
            onDelete={(id) => deleteItem(id)}
          />
        ))}
        <AddItemForm
          defaultDate={effectiveTab}
          onAdd={async (label, store, date, isPrivate) => {
            if (!householdId) return;
            await addItem(householdId, label, store ?? "list", date ?? undefined, isPrivate ? (user?.id ?? null) : null);
          }}
        />

        {/* Private items section */}
        {privateVisible.length > 0 && (
          <>
            <div className="border-t border-border/20 mt-4 mb-4" />
            <div className="flex items-center gap-1.5 mb-2">
              <Lock size={9} className="text-muted-foreground" />
              <p className="text-[10px] tracking-widest text-muted-foreground">mine only</p>
            </div>
            {privateVisible.map((item) => (
              <ItemRow key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
