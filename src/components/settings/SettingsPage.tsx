"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { CalendarSettings } from "./CalendarSettings";
import { WeeklyChoresSettings } from "./WeeklyChoresSettings";
import { SubscriptionSettings } from "./SubscriptionSettings";
import { X, LogOut } from "lucide-react";

export function SettingsPage() {
  const { householdId, inviteCode, setSettingsOpen, signOut } = useAuthStore();
  const { load } = useSettingsStore();

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
  }, [householdId, load]);

  return (
    <div className="fixed inset-0 bg-background z-40 overflow-y-auto">
      <div className="max-w-xl mx-auto px-7 py-8 space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">settings</p>
            <h2 className="text-[22px] tracking-wide">settings</h2>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {inviteCode && (
          <div className="space-y-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">invite code</p>
            <p className="text-xl tracking-widest font-medium">{inviteCode}</p>
            <p className="text-[11px] text-muted-foreground">share this code with your partner</p>
          </div>
        )}

        <SubscriptionSettings />

        <div className="border-t border-border pt-6">
          <WeeklyChoresSettings />
        </div>

        <div className="border-t border-border pt-6">
          <CalendarSettings />
        </div>

        <div className="border-t border-border pt-6">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors tracking-wider"
          >
            <LogOut size={12} />
            sign out
          </button>
        </div>
      </div>
    </div>
  );
}
