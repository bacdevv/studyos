/**
 * Index a time window once instead of scanning every segment and every log for
 * every calendar cell / chart data point. Boundaries use the profile timezone,
 * so 23/25-hour daylight-saving days remain correct.
 */
import { fromZonedTime } from "date-fns-tz";
import { getDay, parseISO } from "date-fns";
import { datesBetween, shiftDate } from "./analytics";
import type { Habit, HabitLog, Segment } from "@/types/models";

export function studyMinutesByDay(
  segments: Segment[], start: string, end: string, timezone: string,
): Map<string, number> {
  const days = datesBetween(start, end);
  const totals = new Map(days.map((day) => [day, 0]));
  if (days.length === 0 || segments.length === 0) return totals;
  const boundaries = days.map((day) => fromZonedTime(`${day}T00:00:00`, timezone).getTime());
  boundaries.push(fromZonedTime(`${shiftDate(days[days.length - 1], 1)}T00:00:00`, timezone).getTime());
  for (const segment of segments) {
    const from = Date.parse(segment.started_at);
    const to = Date.parse(segment.ended_at);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= boundaries[0] || from >= boundaries[boundaries.length - 1]) continue;
    // Find the first day whose end boundary is greater than the segment start.
    let low = 0, high = days.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (boundaries[mid + 1] <= from) low = mid + 1;
      else high = mid;
    }
    for (let i = low; i < days.length && boundaries[i] < to; i++) {
      const ms = Math.max(0, Math.min(to, boundaries[i + 1]) - Math.max(from, boundaries[i]));
      if (ms) totals.set(days[i], (totals.get(days[i]) ?? 0) + ms / 60000);
    }
  }
  return totals;
}

export type DayCompletion = { due: number; done: number; rate: number };
export function habitCompletionByDay(
  habits: Habit[], logs: HabitLog[], start: string, end: string,
): Map<string, DayCompletion> {
  const days = datesBetween(start, end);
  const result = new Map<string, DayCompletion>();
  const eligible = habits.filter((habit) => !habit.archived && habit.kind !== "measurement");
  const values = new Map<string, number>();
  for (const log of logs) {
    if (log.date >= start && log.date <= end) values.set(`${log.habit_id}:${log.date}`, Number(log.value));
  }
  for (const day of days) {
    const weekday = getDay(parseISO(day));
    let due = 0, done = 0;
    for (const habit of eligible) {
      if (day >= habit.start_date && habit.days.includes(weekday)) {
        due++;
        if ((values.get(`${habit.id}:${day}`) ?? -Infinity) >= Number(habit.target)) done++;
      }
    }
    result.set(day, { due, done, rate: due ? Math.round(100 * done / due) : 0 });
  }
  return result;
}

export function aggregateCompletion(completion: Map<string, DayCompletion>): DayCompletion {
  let due = 0, done = 0;
  for (const row of completion.values()) { due += row.due; done += row.done; }
  return { due, done, rate: due ? Math.round(100 * done / due) : 0 };
}
