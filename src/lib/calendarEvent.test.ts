import { describe, it, expect } from "vitest";
import { withSummary, withSummaries, UNTITLED_EVENT } from "./calendarEvent";
import type { CalendarEvent } from "@/types";

describe("withSummary", () => {
  it("タイトルの無い予定を埋める", () => {
    // Google はタイトルが空の予定に summary を返さない。ここを埋めないと
    // ev.summary.replace(...) が落ち、1件のせいで画面全体が死ぬ。
    expect(withSummary({ id: "1" }).summary).toBe(UNTITLED_EVENT);
  });

  it("あるタイトルは変えない", () => {
    expect(withSummary({ id: "1", summary: "当直" }).summary).toBe("当直");
  });

  it("空文字はそのまま。未設定とは区別する", () => {
    expect(withSummary({ id: "1", summary: "" }).summary).toBe("");
  });

  it("他の項目を落とさない", () => {
    const e = { id: "1", ownerId: "u1", calendarColor: "#fff" };
    expect(withSummary(e)).toMatchObject(e);
  });

  it("配列のうち欠けているものだけ埋める", () => {
    const events = [
      { id: "1" },
      { id: "2", summary: "会議" },
    ] as unknown as CalendarEvent[];
    expect(withSummaries(events).map((e) => e.summary)).toEqual([UNTITLED_EVENT, "会議"]);
  });
});
