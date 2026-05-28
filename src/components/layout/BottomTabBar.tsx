"use client";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

const TABS = [
  { id: "home", label: "home" },
  { id: "calendar", label: "calendar" },
  { id: "cook", label: "cook" },
  { id: "workout", label: "workout" },
  { id: "shopping", label: "shopping" },
  { id: "recipe", label: "recipes" },
];

export function BottomTabBar() {
  const { activeTab, setActiveTab, setSettingsOpen } = useAuthStore();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-1 items-center justify-evenly">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "py-3 text-[10px] tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => setSettingsOpen(true)}
        className="w-10 flex-shrink-0 flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="settings"
      >
        <Settings size={14} />
      </button>
    </nav>
  );
}
