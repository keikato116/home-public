import { describe, it, expect } from "vitest";
import { planChoreNotifications, DEFAULT_CHORE_NOTIFY } from "./notifications";
import { RoutineDefinition } from "@/types";

function def(partial: Partial<RoutineDefinition>): RoutineDefinition {
  return {
    id: "1",
    household_id: "h",
    label: "掃除",
    frequency: "daily",
    day_of_week: null,
    day_of_month: null,
    due_date: null,
    user_id: null,
    order: 0,
    created_at: "",
    ...partial,
  } as RoutineDefinition;
}

const on = { ...DEFAULT_CHORE_NOTIFY, enabled: true, hour: 8, minute: 0 };
// 2026-09-14 は月曜
const MON = new Date(2026, 8, 14);
const earlyMorning = new Date(2026, 8, 14, 6, 0);

describe("planChoreNotifications", () => {
  it("オフのときは何も予約しない", () => {
    expect(planChoreNotifications([def({})], { ...on, enabled: false }, MON, earlyMorning)).toEqual([]);
  });

  it("毎日の家事は7日ぶん予約される", () => {
    expect(planChoreNotifications([def({})], on, MON, earlyMorning)).toHaveLength(7);
  });

  it("家事が無い日は予約しない", () => {
    // 火曜だけの家事 → 7日のうち1日だけ
    const weekly = def({ frequency: "weekly", day_of_week: 2 });
    expect(planChoreNotifications([weekly], on, MON, earlyMorning)).toHaveLength(1);
  });

  it("家事が1件も無ければ何も予約しない", () => {
    expect(planChoreNotifications([], on, MON, earlyMorning)).toEqual([]);
  });

  it("今日のぶんは、通知時刻を過ぎていたらとばす", () => {
    const afterEight = new Date(2026, 8, 14, 9, 0);
    // 毎日の家事でも、今日は過ぎているので残り6日
    expect(planChoreNotifications([def({})], on, MON, afterEight)).toHaveLength(6);
  });

  it("件数と家事の名前が本文に入る", () => {
    const [first] = planChoreNotifications(
      [def({ id: "a", label: "風呂" }), def({ id: "b", label: "ゴミ" })],
      on, MON, earlyMorning
    );
    expect(first.title).toBe("今日の家事 2件");
    expect(first.body).toBe("風呂、ゴミ");
  });

  it("4件以上は3件だけ並べて残りを件数で示す", () => {
    const many = ["風呂", "ゴミ", "床", "窓", "皿"].map((label, i) =>
      def({ id: String(i), label })
    );
    const [first] = planChoreNotifications(many, on, MON, earlyMorning);
    expect(first.body).toBe("風呂、ゴミ、床 ほか2件");
  });

  it("設定した時刻に予約される", () => {
    const [first] = planChoreNotifications([def({})], { ...on, hour: 21, minute: 30 }, MON, earlyMorning);
    expect(first.schedule.at.getHours()).toBe(21);
    expect(first.schedule.at.getMinutes()).toBe(30);
  });

  it("同じ日を二重に予約しない（IDが重複しない）", () => {
    const ids = planChoreNotifications([def({})], on, MON, earlyMorning).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
