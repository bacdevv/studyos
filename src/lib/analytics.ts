import { addDays, format, parseISO, getDay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Habit, HabitLog, Segment } from "@/types/models";
export const localDate = (date: Date | string, timezone: string) =>
  formatInTimeZone(date, timezone, "yyyy-MM-dd");
export const shiftDate = (date: string, n: number) =>
  format(addDays(parseISO(date), n), "yyyy-MM-dd");
export function datesBetween(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) {
    out.push(d);
    if (out.length > 3660) break;
  }
  return out;
}
export const scheduled = (h: Habit, date: string) =>
  date >= h.start_date && h.days.includes(getDay(parseISO(date)));
export const completed = (h: Habit, logs: HabitLog[], date: string) =>
  logs.some(
    (l) =>
      l.habit_id === h.id &&
      l.date === date &&
      Number(l.value) >= Number(h.target),
  );
export function completionRate(
  habits: Habit[],
  logs: HabitLog[],
  start: string,
  end: string,
) {
  let due = 0,
    done = 0;
  for (const date of datesBetween(start, end))
    for (const h of habits.filter(
      (h) => !h.archived && h.kind !== "measurement",
    ))
      if (scheduled(h, date)) {
        due++;
        if (completed(h, logs, date)) done++;
      }
  return { due, done, rate: due ? Math.round((done / due) * 100) : 0 };
}
export function minutesOnDate(
  segments: Segment[],
  date: string,
  timezone: string,
) {
  const a = fromZonedTime(`${date}T00:00:00`, timezone).getTime(),
    b = fromZonedTime(`${shiftDate(date, 1)}T00:00:00`, timezone).getTime();
  return segments.reduce(
    (sum, s) =>
      sum +
      Math.max(
        0,
        Math.min(Date.parse(s.ended_at), b) -
          Math.max(Date.parse(s.started_at), a),
      ) /
        60000,
    0,
  );
}
export function studyStreak(
  segments: Segment[],
  today: string,
  timezone: string,
) {
  let d = today,
    count = 0;
  if (minutesOnDate(segments, d, timezone) < 1) d = shiftDate(d, -1);
  while (minutesOnDate(segments, d, timezone) >= 1) {
    count++;
    d = shiftDate(d, -1);
    if (count > 3660) break;
  }
  return count;
}
export function habitStreak(h: Habit, logs: HabitLog[], today: string) {
  let count = 0;
  for (let d = today; d >= h.start_date; d = shiftDate(d, -1)) {
    if (!scheduled(h, d)) continue;
    if (completed(h, logs, d)) count++;
    else if (d !== today) break;
  }
  return count;
}
export const progress = (done: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;
export function sessionMinutes(segments: Segment[], id: string) {
  return segments
    .filter((s) => s.session_id === id)
    .reduce(
      (n, s) => n + (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000,
      0,
    );
}
