"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCalendarStore } from "@/store/calendarStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { AuthGate } from "@/components/auth/AuthGate";
import { HouseholdSetup } from "@/components/onboarding/HouseholdSetup";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { HomeTab } from "@/components/home/HomeTab";
import { ShoppingTab } from "@/components/shopping/ShoppingTab";
import { CalendarTab } from "@/components/calendar/CalendarTab";
import { RecipeTab } from "@/components/recipe/RecipeTab";
import { CookTab } from "@/components/cook/CookTab";
import { SplitTab } from "@/components/split/SplitTab";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import { PREMIUM_TABS } from "@/lib/constants";

function MainApp() {
  const { activeTab, settingsOpen, householdId, accessToken, user, setActiveTab } = useAuthStore();
  const entitled = useSubscriptionStore((s) => s.entitled);

  // Prefetch slow data sources immediately on app load, before tabs are opened
  useEffect(() => {
    if (householdId) {
      useCalendarStore.getState().load(householdId, accessToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) useSubscriptionStore.getState().init(user.id);
  }, [user]);

  // 課金が切れた（解約・支払い失敗）状態でプレミアムタブに留まらないよう home に戻す。
  // タブ自体は BottomTabBar 側で消えているので、ここは表示の後始末。
  useEffect(() => {
    if (entitled === false && (PREMIUM_TABS as readonly string[]).includes(activeTab)) {
      setActiveTab("home");
    }
  }, [entitled, activeTab, setActiveTab]);

  const premium = entitled === true;

  return (
    <div className="relative flex flex-col h-screen max-w-xl mx-auto">
      <main
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: "calc(52px + env(safe-area-inset-bottom))" }}
      >
        {activeTab === "home" && <HomeTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "cook" && premium && <CookTab />}
        {activeTab === "recipe" && premium && <RecipeTab />}
        {activeTab === "shopping" && <ShoppingTab />}
        {activeTab === "split" && <SplitTab />}
      </main>

      <BottomTabBar />
      {settingsOpen && <SettingsPage />}
      <PaywallModal />
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
