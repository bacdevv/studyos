"use client";
import { memo, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, parseISO, getDay } from "date-fns";
import {
  datesBetween,
  shiftDate,
  minutesOnDate,
} from "@/lib/analytics";
import type { Dataset } from "@/types/models";
import { studyMinutesByDay, habitCompletionByDay } from "@/lib/analytics-fast";
export const History = memo(function History({ data, today }: { data: Dataset; today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const first = `${month}-01`;
  const next = shiftDate(first, 32).slice(0, 7) + "-01";
  const { dates, minutesByDay, completionByDay } = useMemo(() => {
    const dates = datesBetween(first, shiftDate(next, -1));
    return {
      dates,
      minutesByDay: studyMinutesByDay(data.segments, dates[0], dates[dates.length - 1], data.profile.timezone),
      completionByDay: habitCompletionByDay(data.habits, data.logs, dates[0], dates[dates.length - 1]),
    };
  }, [first, next, data]);
  const offset = (getDay(parseISO(first)) + 6) % 7;
  const logs = data.logs.filter((l) => l.date === selected);
  return (
    <div className="two-columns history-layout">
      <section className="card">
        <div className="card-heading">
          <h2>{format(parseISO(first), "MMMM yyyy")}</h2>
          <div className="toolbar">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftDate(first, -1).slice(0, 7))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="button small"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(today);
              }}
            >
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth(next.slice(0, 7))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <small key={d}>{d}</small>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {dates.map((d) => {
            const minutes = minutesByDay.get(d) ?? 0;
            const habits = completionByDay.get(d) ?? { due: 0, done: 0, rate: 0 };
            return (
              <button
                key={d}
                className={`${d === selected ? "selected" : ""} ${d === today ? "today" : ""}`}
                onClick={() => setSelected(d)}
                aria-label={`${d}: ${Math.round(minutes)} study minutes, ${habits.done} habits complete`}
              >
                <span>{Number(d.slice(-2))}</span>
                {minutes > 0 && <small>{Math.round(minutes)}m</small>}
                {habits.done > 0 && <i />}
              </button>
            );
          })}
        </div>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>{format(parseISO(selected), "EEEE, MMM d")}</h2>
            <p className="muted">
              {Math.round(
                minutesByDay.get(selected) ?? minutesOnDate(data.segments, selected, data.profile.timezone),
              )}{" "}
              minutes of study
            </p>
          </div>
          <CalendarDays size={20} />
        </div>
        {logs.length === 0 ? (
          <div className="empty">
            <h3>No habit entries on this day</h3>
            <p>Saved entries appear here automatically.</p>
          </div>
        ) : (
          <div className="history-entries">
            {logs.map((l) => (
              <div key={l.id}>
                <strong>
                  {data.habits.find((h) => h.id === l.habit_id)?.name}
                </strong>
                <span>
                  {l.value} {data.habits.find((h) => h.id === l.habit_id)?.unit}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="card-footnote">
          The calendar reads the same records as your trackers.
        </p>
      </section>
    </div>
  );
});
