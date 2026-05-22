"use client";

import { useEffect } from "react";
import { useShoppingStore } from "@/store/shoppingStore";
import { useAuthStore } from "@/store/authStore";
import { ShoppingCategoryGroup } from "./ShoppingCategoryGroup";
import { AddShoppingItemForm } from "./AddShoppingItemForm";

export function ShoppingTab() {
  const { householdId } = useAuthStore();
  const { load, subscribeRealtime, itemsByCategory, clearDone, items } = useShoppingStore();

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  const groups = itemsByCategory();
  const hasDone = items.some((i) => i.done);

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
        {Object.entries(groups).map(([cat, items]) => (
          <ShoppingCategoryGroup key={cat} category={cat} items={items} />
        ))}
        <AddShoppingItemForm />
      </div>
    </div>
  );
}
