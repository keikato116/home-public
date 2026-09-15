"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { CalendarSettings } from "./CalendarSettings";
import { WeeklyChoresSettings } from "./WeeklyChoresSettings";
import { SubscriptionSettings } from "./SubscriptionSettings";
import { NotificationSettings } from "./NotificationSettings";
import { BILLING_ENABLED } from "@/lib/constants";
import { HouseholdSettings } from "./HouseholdSettings";
import { NameSettings } from "./NameSettings";
import { MealSettings } from "./MealSettings";
import { DeleteAccount } from "./DeleteAccount";
import { X, LogOut } from "lucide-react";

export function SettingsPage() {
  const { householdId, setSettingsOpen, signOut } = useAuthStore();
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

        <NameSettings />

        <div className="border-t border-border pt-6">
          <HouseholdSettings />
        </div>

        {BILLING_ENABLED && (
          <div className="border-t border-border pt-6">
            <SubscriptionSettings />
          </div>
        )}

        <div className="border-t border-border pt-6">
          <WeeklyChoresSettings />
        </div>

        <div className="border-t border-border pt-6">
          <MealSettings />
        </div>

        <div className="border-t border-border pt-6">
          <NotificationSettings />
        </div>

        <div className="border-t border-border pt-6">
          <CalendarSettings />
        </div>

        <div className="border-t border-border pt-6 space-y-6">
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors tracking-wider"
          >
            <LogOut size={12} />
            sign out
          </button>

          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}
