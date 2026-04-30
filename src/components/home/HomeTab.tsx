"use client";

import { useEffect } from "react";
import { WeatherWidget } from "./WeatherWidget";
import { RoutineTodoList } from "./RoutineTodoList";
import { UrgentTodoList } from "./UrgentTodoList";
import { AddUrgentTodoForm } from "./AddUrgentTodoForm";
import { useTodoStore } from "@/store/todoStore";
import { useAuthStore } from "@/store/authStore";

export function HomeTab() {
  const { householdId } = useAuthStore();
  const { load, subscribeRealtime } = useTodoStore();

  useEffect(() => {
    if (!householdId) return;
    load(householdId);
    const unsub = subscribeRealtime(householdId);
    return unsub;
  }, [householdId, load, subscribeRealtime]);

  const today = new Date();

  return (
    <div className="flex flex-col h-full px-7 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
            {today.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <p className="text-[22px] tracking-wide">
            {today.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
        </div>
        <WeatherWidget />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto">
        <RoutineTodoList />
        <UrgentTodoList />
        <AddUrgentTodoForm />
      </div>
    </div>
  );
}
