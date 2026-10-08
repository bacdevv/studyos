"use client";
import { useEffect, useState, useRef } from "react";
import { Play, Pause, Square, Plus, Pencil, Trash2, Timer } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { sessionMinutes } from "@/lib/analytics";
import { sessionSchema } from "@/lib/validation";
import { Dialog } from "@/components/ui/dialog";
import type { Dataset, StudySession } from "@/types/models";
import type { Mutate } from "./habits";
export function Focus({
  data,
  mutate,
  busy,
}: {
  data: Dataset;
  mutate: Mutate;
  busy: boolean;
}) {
  const active = data.sessions.find((s) => s.status !== "completed");
  const [subject, setSubject] = useState("Self-study");
  const [now, setNow] = useState(() => Date.now());
  const startId = useRef<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = active
    ? Math.floor(
        sessionMinutes(data.segments, active.id) * 60 +
          (active.active_since
            ? Math.max(
                0,
                Math.min(86400000, now - Date.parse(active.active_since)),
              ) / 1000
            : 0),
      )
    : 0;
  const display = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="focus-card">
      <div className="focus-heading">
        <span>
          <Timer size={18} /> FOCUS SPACE
        </span>
        <span className="focus-status">
          {active?.status === "running"
            ? "In progress"
            : active?.status === "paused"
              ? "Paused"
              : "Ready when you are"}
        </span>
      </div>
      <h2>One thing at a time.</h2>
      <p>Give your next idea a little undivided attention.</p>
      <div className="timer" aria-live="off">
        {display}
      </div>
      {active ? (
        <div className="focus-subject">{active.subject}</div>
      ) : (
        <input
          aria-label="Focus subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={100}
        />
      )}
      <div className="focus-actions">
        {!active ? (
          <button
            className="button focus-button"
            disabled={busy || !subject.trim()}
            onClick={async () => {
              startId.current ??= crypto.randomUUID();
              if (
                await mutate("focus", {
                  id: startId.current,
                  action: "start",
                  subject,
                })
              ) {
                startId.current = null;
              }
            }}
          >
            <Play size={17} />
            Start focus
          </button>
        ) : (
          <>
            <button
              className="button focus-button"
              disabled={busy}
              onClick={() =>
                mutate("focus", {
                  id: active.id,
                  action: active.status === "running" ? "pause" : "resume",
                  subject: active.subject,
                })
              }
            >
              {active.status === "running" ? (
                <Pause size={17} />
              ) : (
                <Play size={17} />
              )}{" "}
              {active.status === "running" ? "Pause" : "Resume"}
            </button>
            <button
              className="button focus-secondary"
              disabled={busy}
              onClick={() =>
                mutate("focus", {
                  id: active.id,
                  action: "finish",
                  subject: active.subject,
                })
              }
            >
              <Square size={15} />
              Finish
            </button>
          </>
        )}
      </div>
      <small>
        {active
          ? "Your timer survives refreshes. Paused time is excluded."
          : "No rush. Just you and what matters."}
      </small>
    </section>
  );
}
function SessionForm({
  session,
  data,
  mutate,
  onClose,
}: {
  session?: StudySession;
  data: Dataset;
  mutate: Mutate;
  onClose: () => void;
}) {
  const timezone = data.profile.timezone;
  const segments = data.segments.filter((s) => s.session_id === session?.id);
  const now = new Date();
  const [id] = useState(() => session?.id ?? crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
          const row = sessionSchema.parse({
            id,
            subject: form.get("subject"),
            note: form.get("note"),
            start: fromZonedTime(
              String(form.get("start")),
              timezone,
            ).toISOString(),
            end: fromZonedTime(String(form.get("end")), timezone).toISOString(),
          });
          if (await mutate("session", row)) onClose();
        } catch {
          setError("Enter a valid subject and a time range of up to 24 hours.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Subject
        <input
          name="subject"
          defaultValue={session?.subject}
          placeholder="e.g. Machine Learning"
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Start
          <input
            name="start"
            type="datetime-local"
            required
            defaultValue={formatInTimeZone(
              segments[0]?.started_at ?? new Date(now.getTime() - 30 * 60000),
              timezone,
              "yyyy-MM-dd'T'HH:mm",
            )}
          />
        </label>
        <label>
          End
          <input
            name="end"
            type="datetime-local"
            required
            defaultValue={formatInTimeZone(
              segments.at(-1)?.ended_at ?? now,
              timezone,
              "yyyy-MM-dd'T'HH:mm",
            )}
          />
        </label>
      </div>
      <small className="muted">
        Times are in {timezone}. Overlapping sessions are rejected.
      </small>
      {segments.length > 1 && (
        <p className="notice">
          Editing replaces all focus intervals with this single time range,
          including any pauses. Adjust the range to match your actual study
          time.
        </p>
      )}
      <label>
        Note <span className="muted">(optional)</span>
        <textarea
          name="note"
          defaultValue={session?.note}
          maxLength={2000}
          rows={3}
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" disabled={pending}>
          {pending ? "Saving…" : "Save session"}
        </button>
      </div>
    </form>
  );
}
export function Study({
  data,
  mutate,
  busy,
  onDelete,
}: {
  data: Dataset;
  mutate: Mutate;
  busy: boolean;
  onDelete: (entity: "study_sessions", id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<StudySession>();
  return (
    <div className="study-layout">
      <Focus data={data} mutate={mutate} busy={busy} />
      <section className="card session-card">
        <div className="card-heading">
          <div>
            <h2>Your study log</h2>
            <p className="muted">Every focused minute counts.</p>
          </div>
          <button
            className="button primary small"
            onClick={() => {
              setEdit(undefined);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            Log session
          </button>
        </div>
        {data.sessions.length === 0 ? (
          <div className="empty">
            <Timer size={30} />
            <h3>Your next session starts here.</h3>
            <p>Start the timer or add time you studied earlier.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data.sessions]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((s) => {
                    const start =
                      data.segments.find((v) => v.session_id === s.id)
                        ?.started_at ??
                      s.active_since ??
                      s.created_at;
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.subject}</strong>
                          {s.note && (
                            <small className="table-note">{s.note}</small>
                          )}
                        </td>
                        <td>
                          {formatInTimeZone(
                            start,
                            data.profile.timezone,
                            "MMM d, HH:mm",
                          )}
                        </td>
                        <td>
                          {Math.round(sessionMinutes(data.segments, s.id))} min
                        </td>
                        <td>
                          <span
                            className={`badge ${s.status === "completed" ? "green" : ""}`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div className="toolbar">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${s.subject}`}
                              disabled={busy || s.status !== "completed"}
                              onClick={() => {
                                setEdit(s);
                                setOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${s.subject}`}
                              disabled={busy}
                              onClick={() => onDelete("study_sessions", s.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={edit ? "Edit study session" : "Log a study session"}
        description="Capture the time you invested in learning."
      >
        {open && (
          <SessionForm
            session={edit}
            data={data}
            mutate={mutate}
            onClose={() => setOpen(false)}
          />
        )}
      </Dialog>
    </div>
  );
}
