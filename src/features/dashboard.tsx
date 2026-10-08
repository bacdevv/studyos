"use client";
import { memo, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Clock3, Target, Flame, CheckCheck, BookOpen } from "lucide-react";
import { format, parseISO, getDay } from "date-fns";
import {
  completionRate,
  datesBetween,
  minutesOnDate,
  shiftDate,
  studyStreak,
  progress,
} from "@/lib/analytics";
import { Habits, type Mutate } from "./habits";
import { studyMinutesByDay, habitCompletionByDay, aggregateCompletion } from "@/lib/analytics-fast";
import { Focus } from "./study";
import type { Dataset } from "@/types/models";
export const Stats = memo(function Stats({ data, today }: { data: Dataset; today: string }) {
  const { todayMinutes, week, habits, streak } = useMemo(() => {
    const weekStart = shiftDate(today, -((getDay(parseISO(today)) + 6) % 7));
    const minutes = studyMinutesByDay(data.segments, weekStart, today, data.profile.timezone);
    return {
      todayMinutes: minutes.get(today) ?? 0,
      week: [...minutes.values()].reduce((sum, value) => sum + value, 0),
      habits: completionRate(data.habits, data.logs, today, today),
      streak: studyStreak(data.segments, today, data.profile.timezone),
    };
  }, [data, today]);
  return (
    <div className="stats-grid">
      {[
        {
          title: "Study time today",
          value: (todayMinutes / 60).toFixed(1),
          unit: "hrs",
          foot: `${Math.round(todayMinutes)} minutes of focused learning`,
          icon: Clock3,
          tint: "blue",
        },
        {
          title: "This week",
          value: (week / 60).toFixed(1),
          unit: "hrs",
          foot: `of ${data.profile.weekly_goal_minutes / 60} hour weekly goal`,
          icon: Target,
          tint: "violet",
        },
        {
          title: "Habits completed",
          value: `${habits.done}`,
          unit: `/ ${habits.due}`,
          foot: habits.due
            ? `${habits.rate}% of today's scheduled habits`
            : "Create your first daily habit",
          icon: CheckCheck,
          tint: "green",
        },
        {
          title: "Study streak",
          value: streak,
          unit: "days",
          foot: "One focused minute keeps it going",
          icon: Flame,
          tint: "orange",
        },
      ].map((s) => (
        <section className="stat-card" key={s.title}>
          <div className="stat-top">
            <span>{s.title}</span>
            <span className={`stat-icon ${s.tint}`}>
              <s.icon size={18} />
            </span>
          </div>
          <div className="stat-value">
            {s.value}
            <span>{s.unit}</span>
          </div>
          <small>{s.foot}</small>
        </section>
      ))}
    </div>
  );
});
export const Trends = memo(function Trends({
  data,
  today,
  expanded = false,
}: {
  data: Dataset;
  today: string;
  expanded?: boolean;
}) {
  const [range, setRange] = useState("7");
  const [customStart, setCustomStart] = useState(shiftDate(today, -6));
  const [customEnd, setCustomEnd] = useState(today);
  const start =
    range === "custom"
      ? customStart
      : range === "month"
        ? `${today.slice(0, 7)}-01`
        : shiftDate(today, -(Number(range) - 1));
  const end = range === "custom" ? customEnd : today;
  const valid = start <= end && datesBetween(start, end).length <= 366;
  const { chart, total, heat, heatCompletion, rate } = useMemo(() => {
    const monthStart = `${today.slice(0, 7)}-01`;
    const heat = datesBetween(monthStart, today);
    const days = valid ? datesBetween(start, end) : [];
    const minutes = studyMinutesByDay(data.segments, start, valid ? end : start, data.profile.timezone);
    const completion = habitCompletionByDay(data.habits, data.logs, start, valid ? end : start);
    const heatCompletion = habitCompletionByDay(data.habits, data.logs, monthStart, today);
    const chart = days.map((d) => ({
      date: format(parseISO(d), "MMM d"),
      hours: Number(((minutes.get(d) ?? 0) / 60).toFixed(2)),
      completion: completion.get(d)?.rate ?? 0,
    }));
    return {
      chart,
      total: chart.reduce((sum, row) => sum + row.hours, 0),
      heat,
      heatCompletion,
      rate: aggregateCompletion(completion),
    };
  }, [data, start, end, valid, today]);
  return (
    <>
      <section className="card trend-card">
        <div className="card-heading">
          <div>
            <h2>Learning over time</h2>
            <p className="muted">
              {total.toFixed(1)} hours invested in this period
            </p>
          </div>
          <select
            aria-label="Analytics date range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="1">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        {range === "custom" && (
          <div className="range-inputs">
            <label>
              From
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) =>
                  e.target.value && setCustomStart(e.target.value)
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}
        {!valid ? (
          <p className="notice">Choose a range up to 366 days.</p>
        ) : (
          <div
            className="chart-container"
            role="img"
            aria-label={`Study time from ${start} to ${end}: ${total.toFixed(1)} hours`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 10, right: 12, bottom: 0, left: -24 }}
              >
                <defs>
                  <linearGradient id="studyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 5"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  allowDecimals
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text)",
                  }}
                />
                <Area
                  name="Study hours"
                  type="monotone"
                  dataKey="hours"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fill="url(#studyFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="chart-footer">
          <span>
            <i />
            Study hours
          </span>
          <span>Saved focus intervals + manual sessions</span>
        </div>
      </section>
      {expanded && (
        <div className="two-columns">
          <section className="card">
            <div className="card-heading">
              <div>
                <h2>Habit consistency</h2>
                <p className="muted">
                  {rate.done} of {rate.due} scheduled check-ins · {rate.rate}%
                </p>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis
                    dataKey="date"
                    minTickGap={30}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="completion"
                    name="Completion %"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="card-footnote">
              Missing entries count as incomplete. Personal measurements are
              excluded.
            </p>
          </section>
          <section className="card">
            <div className="card-heading">
              <div>
                <h2>This month, one day at a time</h2>
                <p className="muted">{format(parseISO(today), "MMMM yyyy")}</p>
              </div>
            </div>
            <div className="heatmap">
              {heat.map((d) => {
                const score = heatCompletion.get(d) ?? { due: 0, done: 0, rate: 0 };
                return (
                  <div
                    key={d}
                    title={`${d}: ${score.done}/${score.due} habits complete`}
                    style={{
                      background:
                        score.due && score.rate
                          ? `rgba(2,132,199,${0.2 + score.rate / 125})`
                          : "var(--background)",
                      color: score.rate > 60 ? "white" : "var(--muted)",
                    }}
                  >
                    {Number(d.slice(-2))}
                  </div>
                );
              })}
            </div>
            <p className="card-footnote">
              Darker squares mean more scheduled habits completed.
            </p>
            <p className="card-footnote">
              Schedule, target and archive changes recalculate historical habit
              metrics. Study totals exclude currently running, unsaved
              intervals.
            </p>
          </section>
        </div>
      )}
    </>
  );
});
export function Dashboard({
  data,
  today,
  mutate,
  busy,
  onDelete,
}: {
  data: Dataset;
  today: string;
  mutate: Mutate;
  busy: boolean;
  onDelete: (entity: "habits" | "habit_logs", id: string) => void;
}) {
  const start = shiftDate(today, -((getDay(parseISO(today)) + 6) % 7));
  const minutes = datesBetween(start, today).reduce(
    (sum, d) => sum + minutesOnDate(data.segments, d, data.profile.timezone),
    0,
  );
  const pct = progress(minutes, data.profile.weekly_goal_minutes);
  return (
    <>
      <Stats data={data} today={today} />
      <div className="dashboard-main">
        <div className="main-column">
          <Trends data={data} today={today} />
          <Habits
            data={data}
            date={today}
            setDate={() => {}}
            mutate={mutate}
            busy={busy}
            onDelete={onDelete}
            compact
          />
        </div>
        <aside className="right-column">
          <Focus data={data} mutate={mutate} busy={busy} />
          <section className="card weekly-goal">
            <div className="card-heading">
              <h2>Weekly intention</h2>
              <Target size={19} className="muted" />
            </div>
            <div className="goal-value">
              {(minutes / 60).toFixed(1)}
              <span> / {data.profile.weekly_goal_minutes / 60} hrs</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Weekly study goal"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${pct}%` }} />
            </div>
            <p className="muted">
              {pct >= 100
                ? "You reached your weekly study goal."
                : `${(Math.max(0, data.profile.weekly_goal_minutes - minutes) / 60).toFixed(1)} more hours to your goal. You've got this.`}
            </p>
            <Link href="/settings" className="text-link">
              Adjust weekly goal
            </Link>
          </section>
          <div className="quiet-note">
            <BookOpen size={20} />
            <p>
              Progress is built in the ordinary moments you choose to show up.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
