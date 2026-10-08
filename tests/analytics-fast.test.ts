import { describe, expect, it } from "vitest";
import { studyMinutesByDay, habitCompletionByDay, aggregateCompletion } from "../src/lib/analytics-fast";
import { minutesOnDate, completionRate } from "../src/lib/analytics";
import type { Habit, HabitLog, Segment } from "../src/types/models";
const seg = (started_at: string, ended_at: string): Segment => ({
  id: crypto.randomUUID(), session_id: "session", user_id: "user", started_at, ended_at,
});
const habit: Habit = {
  id: "habit-1", user_id: "user", name: "Read", kind: "number", target: 10,
  unit: "pages", days: [0,1,2,3,4,5,6], start_date: "2026-10-07",
  archived: false, position: 0, created_at: "", updated_at: "",
};
const log = (date: string, value: number): HabitLog => ({
  id: date, user_id: "user", habit_id: habit.id, date, value,
  created_at: "", updated_at: "",
});
describe("indexed analytics preserve the original calculations", () => {
  it("splits midnight and aggregates disjoint segments in Vietnam", () => {
    const segments = [
      seg("2026-10-07T16:30:00Z", "2026-10-07T17:30:00Z"),
      seg("2026-10-07T18:00:00Z", "2026-10-07T18:15:00Z"),
    ];
    const indexed = studyMinutesByDay(segments, "2026-10-07", "2026-10-09", "Asia/Ho_Chi_Minh");
    for (const day of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
      expect(indexed.get(day)).toBe(minutesOnDate(segments, day, "Asia/Ho_Chi_Minh"));
    }
  });
  it("handles DST-shortened days", () => {
    const segments = [seg("2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z")];
    const indexed = studyMinutesByDay(segments, "2026-03-07", "2026-03-09", "America/New_York");
    expect(indexed.get("2026-03-08")).toBe(1380);
  });
  it("matches per-day and entire-range habit completion", () => {
    const logs = [log("2026-10-07", 10), log("2026-10-08", 2), log("2026-10-09", 12)];
    const indexed = habitCompletionByDay([habit], logs, "2026-10-06", "2026-10-09");
    for (const day of indexed.keys()) {
      expect(indexed.get(day)).toEqual(completionRate([habit], logs, day, day));
    }
    expect(aggregateCompletion(indexed)).toEqual(completionRate([habit], logs, "2026-10-06", "2026-10-09"));
  });
  it("returns empty results safely", () => {
    expect(studyMinutesByDay([], "2026-10-07", "2026-10-08", "UTC").get("2026-10-07")).toBe(0);
    expect(aggregateCompletion(new Map())).toEqual({ due: 0, done: 0, rate: 0 });
  });
});
