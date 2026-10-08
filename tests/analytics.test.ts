import { describe, it, expect } from "vitest";
import {
  completionRate,
  minutesOnDate,
  studyStreak,
  habitStreak,
  progress,
  localDate,
  scheduled,
} from "../src/lib/analytics";
import {
  habitSchema,
  sessionSchema,
  profileSchema,
} from "../src/lib/validation";
import type { Habit, HabitLog, Segment } from "../src/types/models";
const habit: Habit = {
  id: "b0d4fc9a-e45d-4e9d-8c1d-6cbd38d14134",
  user_id: "user",
  name: "Read",
  kind: "number",
  target: 10,
  unit: "pages",
  days: [0, 1, 2, 3, 4, 5, 6],
  start_date: "2026-10-01",
  archived: false,
  position: 0,
  created_at: "",
  updated_at: "",
};
const log = (date: string, value: number): HabitLog => ({
  id: date,
  user_id: "user",
  habit_id: habit.id,
  date,
  value,
  created_at: "",
  updated_at: "",
});
const segment = (start: string, end: string): Segment => ({
  id: start,
  session_id: "session",
  user_id: "user",
  started_at: start,
  ended_at: end,
});
describe("study time", () => {
  it("splits a session across Vietnam midnight", () => {
    const s = [segment("2026-10-07T16:30:00Z", "2026-10-07T17:30:00Z")];
    expect(minutesOnDate(s, "2026-10-07", "Asia/Ho_Chi_Minh")).toBe(30);
    expect(minutesOnDate(s, "2026-10-08", "Asia/Ho_Chi_Minh")).toBe(30);
  });
  it("handles a 23-hour daylight saving day", () => {
    const s = [segment("2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z")];
    expect(minutesOnDate(s, "2026-03-08", "America/New_York")).toBe(1380);
  });
  it("excludes gaps between focus intervals", () => {
    const s = [
      segment("2026-10-08T01:00:00Z", "2026-10-08T01:15:00Z"),
      segment("2026-10-08T01:30:00Z", "2026-10-08T01:45:00Z"),
    ];
    expect(minutesOnDate(s, "2026-10-08", "UTC")).toBe(30);
  });
  it("returns zero on empty data", () =>
    expect(minutesOnDate([], "2026-10-08", "UTC")).toBe(0));
  it("keeps a streak until today ends", () => {
    const s = [
      segment("2026-10-06T01:00:00Z", "2026-10-06T01:01:00Z"),
      segment("2026-10-07T01:00:00Z", "2026-10-07T01:01:00Z"),
    ];
    expect(studyStreak(s, "2026-10-08", "UTC")).toBe(2);
    expect(studyStreak(s, "2026-10-09", "UTC")).toBe(0);
  });
  it("uses the profile timezone for today", () =>
    expect(localDate("2026-10-07T18:00:00Z", "Asia/Ho_Chi_Minh")).toBe(
      "2026-10-08",
    ));
});
describe("habit analytics", () => {
  it("missing entries never count as completed", () =>
    expect(completionRate([habit], [], "2026-10-01", "2026-10-03")).toEqual({
      due: 3,
      done: 0,
      rate: 0,
    }));
  it("measures completion against target, not presence", () =>
    expect(
      completionRate(
        [habit],
        [log("2026-10-01", 9), log("2026-10-02", 10)],
        "2026-10-01",
        "2026-10-02",
      ),
    ).toEqual({ due: 2, done: 1, rate: 50 }));
  it("excludes dates before creation and measurements", () =>
    expect(
      completionRate(
        [habit, { ...habit, kind: "measurement" }],
        [],
        "2026-09-30",
        "2026-10-01",
      ).due,
    ).toBe(1));
  it("skips unscheduled days in streaks", () => {
    const h = { ...habit, days: [1, 3, 5], start_date: "2026-10-05" };
    expect(
      habitStreak(
        h,
        [log("2026-10-05", 10), log("2026-10-07", 10)],
        "2026-10-08",
      ),
    ).toBe(2);
    expect(scheduled(h, "2026-10-08")).toBe(false);
  });
  it("returns sensible empty progress and clamps over-completion", () => {
    expect(progress(0, 0)).toBe(0);
    expect(progress(110, 100)).toBe(100);
    expect(progress(3, 4)).toBe(75);
  });
});
describe("validation", () => {
  it("rejects empty habit names", () =>
    expect(habitSchema.safeParse({ ...habit, name: "" }).success).toBe(false));
  it("rejects empty schedules", () =>
    expect(habitSchema.safeParse({ ...habit, days: [] }).success).toBe(false));
  it("rejects reversed times", () =>
    expect(
      sessionSchema.safeParse({
        id: habit.id,
        subject: "ML",
        note: "",
        start: "2026-10-08T02:00:00Z",
        end: "2026-10-08T01:00:00Z",
      }).success,
    ).toBe(false));
  it("rejects invalid timezones", () =>
    expect(
      profileSchema.safeParse({
        display_name: "",
        timezone: "invalid",
        theme: "system",
        weekly_goal_minutes: 600,
      }).success,
    ).toBe(false));
});
