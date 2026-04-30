"use client";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

const TABS = [
  { id: "home", label: "ホーム" },
  { id: "shopping", label: "買い物" },
  { id: "calendar", label: "カレンダー" },
  { id: "recipe", label: "レシピ" },
];

export function BottomTabBar() {
  const { activeTab, setActiveTab, setSettingsOpen } = useAuthStore();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex-1 py-3 text-[10px] tracking-widest transition-colors",
            activeTab === tab.id
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
      <button
        onClick={() => setSettingsOpen(true)}
        className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="設定"
      >
        <Settings size={14} />
      </button>
    </nav>
  );
}
