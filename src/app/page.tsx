"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { AuthGate } from "@/components/auth/AuthGate";
import { HouseholdSetup } from "@/components/onboarding/HouseholdSetup";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { HomeTab } from "@/components/home/HomeTab";
import { ShoppingTab } from "@/components/shopping/ShoppingTab";
import { CalendarTab } from "@/components/calendar/CalendarTab";
import { RecipeTab } from "@/components/recipe/RecipeTab";
import { CookTab } from "@/components/cook/CookTab";
import { WorkoutTab } from "@/components/workout/WorkoutTab";
import { SplitTab } from "@/components/split/SplitTab";
import { SettingsPage } from "@/components/settings/SettingsPage";

function MainApp() {
  const { activeTab, settingsOpen } = useAuthStore();

  return (
    <div className="relative flex flex-col h-screen max-w-xl mx-auto">
      <main
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: "calc(52px + env(safe-area-inset-bottom))" }}
      >
        {activeTab === "home" && <HomeTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "cook" && <CookTab />}
        {activeTab === "workout" && <WorkoutTab />}
        {activeTab === "recipe" && <RecipeTab />}
        {activeTab === "shopping" && <ShoppingTab />}
        {activeTab === "split" && <SplitTab />}
      </main>

      <BottomTabBar />
      {settingsOpen && <SettingsPage />}
    </div>
  );
}

export default function Page() {
  const { user, householdId, loading, init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground tracking-widest">loading...</p>
      </div>
    );
  }

  if (!user) return <AuthGate />;
  if (!householdId) return <HouseholdSetup />;
  return <MainApp />;
}
