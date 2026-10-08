import { describe, it, expect } from "vitest";
import { applyMutation, type MutationResponse } from "../src/lib/workspace-data";
import type { Dataset, Habit, HabitLog, Segment, StudySession } from "../src/types/models";

const habit: Habit = {
  id: "habit-1", user_id: "user-1", name: "Read", kind: "checkbox",
  target: 1, unit: "", days: [0, 1, 2, 3, 4, 5, 6],
  start_date: "2026-10-08", archived: false, position: 0,
  created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z",
};
const log: HabitLog = {
  id: "log-1", user_id: "user-1", habit_id: "habit-1", date: "2026-10-08",
  value: 1, created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z",
};
const session: StudySession = {
  id: "study-1", user_id: "user-1", subject: "AI", note: "", status: "running",
  active_since: "2026-10-08T01:00:00Z",
  created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z",
};
const segment: Segment = {
  id: "segment-1", user_id: "user-1", session_id: "study-1",
  started_at: "2026-10-08T01:00:00Z", ended_at: "2026-10-08T02:00:00Z",
};
const dataset: Dataset = {
  habits: [habit], logs: [log], sessions: [session], segments: [segment],
  profile: { id: "user-1", display_name: "Student", timezone: "Asia/Ho_Chi_Minh",
    theme: "light", weekly_goal_minutes: 600,
    created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z" },
  email: "user@example.com",
};
const ack = (fields: Partial<MutationResponse>): MutationResponse => ({ ok: true, ...fields });

describe("incremental workspace updates", () => {
  it("upserts a newly created habit and replaces an edited habit without duplicates", () => {
    const next = applyMutation(dataset, "habit", {}, ack({ habit: { ...habit, id: "habit-2" } }));
    expect(next.habits).toHaveLength(2);
    const edited = applyMutation(next, "habit", {}, ack({ habit: { ...habit, name: "AI course" } }));
    expect(edited.habits).toHaveLength(2);
    expect(edited.habits.find((h) => h.id === habit.id)?.name).toBe("AI course");
    expect(edited.segments).toBe(dataset.segments);
  });

  it("uses the server-returned log to update progress exactly once", () => {
    const changed = applyMutation(dataset, "log", {}, ack({ log: { ...log, value: 0 } }));
    expect(changed.logs).toHaveLength(1);
    expect(changed.logs[0].value).toBe(0);
  });

  it("updates only one focus session and its segments, preserving other sessions", () => {
    const other: StudySession = { ...session, id: "study-2" };
    const original = { ...dataset, sessions: [session, other] };
    const updated = applyMutation(original, "focus", {}, ack({ studyPatch: {
      session: { ...session, status: "paused", active_since: null },
      segments: [{ ...segment, ended_at: "2026-10-08T03:00:00Z" }],
    } }));
    expect(updated.sessions).toHaveLength(2);
    expect(updated.sessions[0].status).toBe("paused");
    expect(updated.sessions[1]).toEqual(other);
    expect(updated.segments).toHaveLength(1);
    expect(updated.segments[0].ended_at).toBe("2026-10-08T03:00:00Z");
  });

  it("deleting a habit removes its orphaned logs but keeps study data", () => {
    const next = applyMutation(dataset, "delete", { entity: "habits", id: habit.id }, ack({}));
    expect(next.habits).toEqual([]);
    expect(next.logs).toEqual([]);
    expect(next.sessions).toBe(dataset.sessions);
  });

  it("deleting a study session removes its segments", () => {
    const next = applyMutation(dataset, "delete", { entity: "study_sessions", id: session.id }, ack({}));
    expect(next.sessions).toHaveLength(0);
    expect(next.segments).toHaveLength(0);
  });

  it("updates profile settings without touching tracking data", () => {
    const next = applyMutation(dataset, "profile", {}, ack({ profile: { ...dataset.profile, theme: "dark" } }));
    expect(next.profile.theme).toBe("dark");
    expect(next.habits).toBe(dataset.habits);
  });
});
