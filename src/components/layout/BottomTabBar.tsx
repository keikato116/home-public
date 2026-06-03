"use client";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import {
  Home, Calendar, ChefHat, Dumbbell,
  ShoppingCart, Receipt, BookOpen, Settings,
} from "lucide-react";

const TABS = [
  { id: "home",     icon: Home },
  { id: "calendar", icon: Calendar },
  { id: "cook",     icon: ChefHat },
  { id: "workout",  icon: Dumbbell },
  { id: "shopping", icon: ShoppingCart },
  { id: "split",    icon: Receipt },
  { id: "recipe",   icon: BookOpen },
];

export function BottomTabBar() {
  const { activeTab, setActiveTab, setSettingsOpen, bumpCalendarView } = useAuthStore();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-1 items-center justify-evenly">
        {TABS.map(({ id, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (activeTab === id && id === "calendar") bumpCalendarView();
                else setActiveTab(id);
              }}
              className="relative flex flex-col items-center justify-center py-3 px-2 transition-colors"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                className={cn(
                  "transition-colors",
                  active ? "text-foreground" : "text-muted-foreground/60"
                )}
              />
              {active && (
                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setSettingsOpen(true)}
        className="w-10 flex-shrink-0 flex items-center justify-center py-3 text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="settings"
      >
        <Settings size={18} strokeWidth={1.5} />
      </button>
    </nav>
  );
}
