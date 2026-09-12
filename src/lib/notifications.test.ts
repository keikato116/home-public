import { describe, it, expect } from "vitest";
import { planChoreNotifications, parseNotifyAt, DEFAULT_CHORE_NOTIFY } from "./notifications";
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
    notify_at: "08:00:00",
    user_id: null,
    order: 0,
    created_at: "",
    ...partial,
  } as RoutineDefinition;
}

const on = { ...DEFAULT_CHORE_NOTIFY, enabled: true };
// 2026-09-14 は月曜
const MON = new Date(2026, 8, 14);
const earlyMorning = new Date(2026, 8, 14, 6, 0);
const onDay1 = <T extends { schedule: { at: Date } }>(ns: T[]) =>
  ns.filter((n) => n.schedule.at.getDate() === 14);

describe("parseNotifyAt", () => {
  it("Postgres の time 型（HH:MM:SS）を読む", () => {
    expect(parseNotifyAt("07:30:00")).toBe(7 * 60 + 30);
  });

  it("HH:MM でも読む", () => {
    expect(parseNotifyAt("21:05")).toBe(21 * 60 + 5);
  });

  it("未設定・壊れた値は null", () => {
    expect(parseNotifyAt(null)).toBeNull();
    expect(parseNotifyAt("")).toBeNull();
    expect(parseNotifyAt("あさ")).toBeNull();
    expect(parseNotifyAt("25:00")).toBeNull();
  });
});

describe("planChoreNotifications", () => {
  it("オフのときは何も予約しない", () => {
    expect(planChoreNotifications([def({})], { enabled: false }, MON, earlyMorning)).toEqual([]);
  });

  it("時刻を入れた毎日の家事は7日ぶん予約される", () => {
    expect(planChoreNotifications([def({})], on, MON, earlyMorning)).toHaveLength(7);
  });

  it("時刻が未設定の家事は通知しない", () => {
    expect(planChoreNotifications([def({ notify_at: null })], on, MON, earlyMorning)).toEqual([]);
  });

  it("時刻を入れたものだけが通知される", () => {
    const chores = [
      def({ id: "a", label: "ゴミ", notify_at: "07:00:00" }),
      def({ id: "b", label: "掃除", notify_at: null }),
    ];
    const day1 = onDay1(planChoreNotifications(chores, on, MON, earlyMorning));
    expect(day1).toHaveLength(1);
    expect(day1[0].body).toBe("ゴミ");
  });

  it("家事が1件も無ければ何も予約しない", () => {
    expect(planChoreNotifications([], on, MON, earlyMorning)).toEqual([]);
  });

  it("家事が無い日は予約しない", () => {
    const weekly = def({ frequency: "weekly", day_of_week: 2 });
    expect(planChoreNotifications([weekly], on, MON, earlyMorning)).toHaveLength(1);
  });

  it("今日のぶんは、通知時刻を過ぎていたらとばす", () => {
    const afterEight = new Date(2026, 8, 14, 9, 0);
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
    const many = ["風呂", "ゴミ", "床", "窓", "皿"].map((label, i) => def({ id: String(i), label }));
    const [first] = planChoreNotifications(many, on, MON, earlyMorning);
    expect(first.body).toBe("風呂、ゴミ、床 ほか2件");
  });

  it("設定した時刻に予約される", () => {
    const [first] = planChoreNotifications([def({ notify_at: "21:30:00" })], on, MON, earlyMorning);
    expect(first.schedule.at.getHours()).toBe(21);
    expect(first.schedule.at.getMinutes()).toBe(30);
  });
});

describe("planChoreNotifications: 家事ごとの時刻", () => {
  it("朝の家事と夜の家事が別々の通知になる", () => {
    const chores = [
      def({ id: "a", label: "ゴミ", notify_at: "07:00:00" }),
      def({ id: "b", label: "皿洗い", notify_at: "20:00:00" }),
    ];
    const day1 = onDay1(planChoreNotifications(chores, on, MON, earlyMorning));
    expect(day1).toHaveLength(2);
    expect(day1[0].schedule.at.getHours()).toBe(7);
    expect(day1[0].body).toBe("ゴミ");
    expect(day1[1].schedule.at.getHours()).toBe(20);
    expect(day1[1].body).toBe("皿洗い");
  });

  it("同じ時刻の家事は1件にまとまる", () => {
    const chores = [
      def({ id: "a", label: "ゴミ", notify_at: "07:00:00" }),
      def({ id: "b", label: "洗濯", notify_at: "07:00:00" }),
    ];
    const day1 = onDay1(planChoreNotifications(chores, on, MON, earlyMorning));
    expect(day1).toHaveLength(1);
    expect(day1[0].title).toBe("今日の家事 2件");
    expect(day1[0].body).toBe("ゴミ、洗濯");
  });

  it("早い時刻だけ過ぎている場合、残りは予約される", () => {
    const chores = [
      def({ id: "a", label: "ゴミ", notify_at: "07:00:00" }),
      def({ id: "b", label: "皿洗い", notify_at: "20:00:00" }),
    ];
    const noon = new Date(2026, 8, 14, 12, 0);
    const day1 = onDay1(planChoreNotifications(chores, on, MON, noon));
    expect(day1).toHaveLength(1);
    expect(day1[0].body).toBe("皿洗い");
  });

  it("時刻が違っても ID は重複しない", () => {
    const chores = [
      def({ id: "a", label: "ゴミ", notify_at: "07:00:00" }),
      def({ id: "b", label: "皿洗い", notify_at: "20:00:00" }),
      def({ id: "c", label: "掃除", notify_at: "12:00:00" }),
    ];
    const ids = planChoreNotifications(chores, on, MON, earlyMorning).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
