"use client";

import { MealPlan } from "@/types";
import { cn } from "@/lib/utils";

interface DayCellProps {
  date: Date;
  dinnerPlan: MealPlan | undefined;
  lunchPlan: MealPlan | undefined;
  isToday: boolean;
  freeEvening: boolean;
  freeLunch: boolean;
  showLunch: boolean;
  isHighlightedDinner: boolean;
  isHighlightedLunch: boolean;
  onSelectDinner: () => void;
  onSelectLunch: () => void;
}

const FREE_BG = "rgb(59 130 246 / 0.08)";

function displayLabel(label: string | null | undefined): string {
  if (!label) return "";
  const match = label.match(/^外食（(.+)）$/);
  return match ? match[1] : label;
}

export function DayCell({ date, dinnerPlan, lunchPlan, isToday, freeEvening, freeLunch, showLunch, isHighlightedDinner, isHighlightedLunch, onSelectDinner, onSelectLunch }: DayCellProps) {
  const effectiveFreeEvening = freeEvening || isHighlightedDinner;
  const effectiveFreeLunch = freeLunch || isHighlightedLunch;
  const bothFree = effectiveFreeEvening && effectiveFreeLunch;

  return (
    <div className="flex flex-col border-r border-b border-border/20 overflow-hidden min-w-0" style={bothFree ? { backgroundColor: FREE_BG } : undefined}>
      {/* Date number */}
      <div className="flex items-center px-0.5 pt-0.5">
        <span className={cn(
          "text-[9px] leading-none w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0",
          isToday ? "bg-foreground text-background" : "text-muted-foreground"
        )}>
          {date.getDate()}
        </span>
      </div>
      {/* Lunch */}
      {showLunch && (
        <button onClick={onSelectLunch} className="flex-1 text-left px-0.5 min-w-0 border-b border-border/10" style={!bothFree && effectiveFreeLunch ? { backgroundColor: FREE_BG } : undefined}>
          <span className={cn("text-[7px] leading-tight truncate block", lunchPlan?.label ? "text-foreground" : "")}>
            {displayLabel(lunchPlan?.label)}
          </span>
        </button>
      )}
      {/* Dinner */}
      <button onClick={onSelectDinner} className="flex-1 text-left px-0.5 pb-0.5 min-w-0" style={!bothFree && effectiveFreeEvening ? { backgroundColor: FREE_BG } : undefined}>
        <span className={cn("text-[8px] leading-tight truncate w-full block", dinnerPlan?.label ? "text-foreground" : "")}>
          {displayLabel(dinnerPlan?.label)}
        </span>
      </button>
    </div>
  );
}
