"use client";

import { ShoppingItem } from "@/types";
import { useShoppingStore } from "@/store/shoppingStore";
import { cn } from "@/lib/utils";

interface Props {
  category: string;
  items: ShoppingItem[];
}

export function ShoppingCategoryGroup({ category, items }: Props) {
  const { toggleItem, deleteItem } = useShoppingStore();

  return (
    <div>
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">{category}</p>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-border group">
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
            className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
