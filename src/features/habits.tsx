"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Check,
  Flame,
  MoreHorizontal,
  Archive,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { habitSchema } from "@/lib/validation";
import { scheduled, completed, habitStreak } from "@/lib/analytics";
import { Dialog } from "@/components/ui/dialog";
import type { Dataset, Habit } from "@/types/models";
export type Mutate = (type: string, data: unknown) => Promise<boolean>;
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function HabitForm({
  habit,
  today,
  count,
  onSave,
  onClose,
}: {
  habit?: Habit;
  today: string;
  count: number;
  onSave: Mutate;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof habitSchema>>({
    resolver: zodResolver(habitSchema),
    defaultValues: habit
      ? { ...habit, target: Number(habit.target) }
      : {
          id: crypto.randomUUID(),
          name: "",
          kind: "checkbox",
          target: 1,
          unit: "",
          days: [0, 1, 2, 3, 4, 5, 6],
          start_date: today,
          archived: false,
          position: count,
        },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const days = useWatch({ control: form.control, name: "days" });
  return (
    <form
      onSubmit={form.handleSubmit(async (v) => {
        if (
          await onSave("habit", {
            ...v,
            target: v.kind === "checkbox" ? 1 : v.target,
            unit: v.kind === "checkbox" ? "" : v.unit,
          })
        )
          onClose();
      })}
      className="form-stack"
    >
      <label>
        Habit name
        <input
          {...form.register("name")}
          placeholder="e.g. Read a little every day"
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Tracking type
          <select {...form.register("kind")}>
            <option value="checkbox">Checkbox</option>
            <option value="number">Number</option>
            <option value="duration">Duration</option>
            <option value="measurement">Personal measurement</option>
          </select>
        </label>
        <label>
          Start date
          <input type="date" {...form.register("start_date")} />
        </label>
      </div>
      {kind !== "checkbox" && (
        <div className="form-grid">
          <label>
            {kind === "measurement" ? "Reference value" : "Daily target"}
            <input
              type="number"
              step="any"
              min="0.001"
              {...form.register("target", { valueAsNumber: true })}
            />
          </label>
          <label>
            Unit
            <input
              {...form.register("unit")}
              placeholder={
                kind === "duration"
                  ? "minutes"
                  : kind === "measurement"
                    ? "kg / mg/dL"
                    : "pages"
              }
            />
          </label>
        </div>
      )}
      {kind === "measurement" && (
        <p className="notice">
          Private personal log. Measurements are excluded from completion
          scores.
        </p>
      )}
      <fieldset>
        <legend>Repeat on</legend>
        <div className="day-picker">
          {dayLabels.map((d, i) => (
            <label key={d} className={days.includes(i) ? "selected" : ""}>
              <input
                type="checkbox"
                checked={days.includes(i)}
                onChange={(e) =>
                  form.setValue(
                    "days",
                    e.target.checked
                      ? [...days, i]
                      : days.filter((v) => v !== i),
                    { shouldValidate: true },
                  )
                }
              />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      {Object.values(form.formState.errors).map((e, i) => (
        <p className="error-text" role="alert" key={i}>
          {e.message}
        </p>
      ))}
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : "Save habit"}
        </button>
      </div>
    </form>
  );
}
function ValueInput({
  value,
  unit,
  save,
  disabled,
}: {
  value: number | undefined;
  unit: string;
  save: (value: number) => Promise<boolean>;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  return (
    <form
      className="inline-value"
      onSubmit={async (e) => {
        e.preventDefault();
        if (draft !== "" && (await save(Number(draft)))) setDraft(draft);
      }}
    >
      <input
        aria-label={`Value in ${unit || "units"}`}
        type="number"
        min="0"
        max="1000000000"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="—"
        required
      />
      <span>{unit}</span>
      <button
        className="icon-button"
        aria-label="Save value"
        disabled={disabled || draft === ""}
      >
        <Check size={16} />
      </button>
    </form>
  );
}
export function Habits({
  data,
  date,
  setDate,
  mutate,
  busy,
  onDelete,
  compact = false,
}: {
  data: Dataset;
  date: string;
  setDate: (v: string) => void;
  mutate: Mutate;
  busy: boolean;
  onDelete: (entity: "habits" | "habit_logs", id: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<Habit | undefined>();
  const [open, setOpen] = useState(false);
  const [archives, setArchives] = useState(false);
  const habits = data.habits
    .filter((h) => h.archived === archives)
    .sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at),
    );
  const visible = compact
    ? habits.filter((h) => scheduled(h, date)).slice(0, 5)
    : habits;
  return (
    <section className="card habit-panel">
      <div className="card-heading">
        <div>
          <h2>{compact ? "Today's habits" : "Your daily rhythm"}</h2>
          <p className="muted">
            {compact
              ? "A few small wins add up."
              : "Track what matters to you, your way."}
          </p>
        </div>
        <div className="toolbar">
          {!compact && (
            <input
              type="date"
              aria-label="Tracking date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          )}
          <button
            className="button small"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            New habit
          </button>
        </div>
      </div>
      {!compact && (
        <div className="subtabs">
          <button
            className={!archives ? "active" : ""}
            onClick={() => setArchives(false)}
          >
            Active
          </button>
          <button
            className={archives ? "active" : ""}
            onClick={() => setArchives(true)}
          >
            Archived
          </button>
        </div>
      )}
      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Check />
          </span>
          <h3>
            {archives ? "No archived habits" : "Start with one small habit"}
          </h3>
          <p>
            {archives
              ? "Archived habits stay available here."
              : "Add something you want to make time for."}
          </p>
          {!archives && (
            <button
              className="button primary small"
              onClick={() => setOpen(true)}
            >
              Create a habit
            </button>
          )}
        </div>
      ) : (
        <div className="habit-list">
          {visible.map((h, i) => {
            const log = data.logs.find(
              (l) => l.habit_id === h.id && l.date === date,
            );
            const done = completed(h, data.logs, date);
            const due = scheduled(h, date);
            return (
              <div className="habit-row" key={h.id}>
                <div className={`habit-symbol ${done ? "done" : ""}`}>
                  {h.kind === "checkbox" ? (
                    <Check size={18} />
                  ) : h.kind === "duration" ? (
                    "↗"
                  ) : h.kind === "measurement" ? (
                    "≈"
                  ) : (
                    "#"
                  )}
                </div>
                <div className="habit-info">
                  <strong>{h.name}</strong>
                  <small>
                    {h.kind === "measurement"
                      ? "Personal measurement"
                      : h.kind === "checkbox"
                        ? "Daily check-in"
                        : `${h.target} ${h.unit} target`}
                    {!due ? " · Not scheduled" : ""}
                  </small>
                </div>
                {h.kind !== "measurement" && (
                  <span className="streak">
                    <Flame size={14} />
                    {habitStreak(h, data.logs, date)}
                  </span>
                )}
                {h.kind === "checkbox" ? (
                  <button
                    className={`check-button ${done ? "checked" : ""}`}
                    disabled={busy || !due || archives}
                    onClick={() =>
                      mutate("log", {
                        habit_id: h.id,
                        date,
                        value: done ? 0 : 1,
                      })
                    }
                    aria-label={`${done ? "Uncheck" : "Complete"} ${h.name}`}
                    aria-pressed={done}
                  >
                    {done && <Check size={17} />}
                  </button>
                ) : (
                  <ValueInput
                    key={`${h.id}-${date}-${log?.value}`}
                    value={log?.value}
                    unit={h.unit}
                    disabled={busy || !due || archives}
                    save={(value) =>
                      mutate("log", { habit_id: h.id, date, value })
                    }
                  />
                )}
                <details className="row-menu">
                  <summary aria-label={`Actions for ${h.name}`}>
                    <MoreHorizontal size={18} />
                  </summary>
                  <div>
                    <button
                      onClick={() => {
                        setEditing(h);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      disabled={busy || i === 0}
                      onClick={() =>
                        mutate("habit", {
                          ...h,
                          position: (habits[0]?.position ?? 0) - 1,
                        })
                      }
                    >
                      <ChevronUp size={14} />
                      Move first
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        mutate("habit", { ...h, archived: !h.archived })
                      }
                    >
                      <Archive size={14} />
                      {h.archived ? "Restore" : "Archive"}
                    </button>
                    {log && (
                      <button onClick={() => onDelete("habit_logs", log.id)}>
                        Clear this entry
                      </button>
                    )}
                    <button
                      className="error-text"
                      onClick={() => onDelete("habits", h.id)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit habit" : "Make a little space for progress"}
        description="Choose what to track and when it fits your week."
      >
        {open && (
          <HabitForm
            habit={editing}
            today={date}
            count={data.habits.length}
            onSave={mutate}
            onClose={() => setOpen(false)}
          />
        )}
      </Dialog>
    </section>
  );
}
