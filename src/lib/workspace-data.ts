/** Apply a confirmed server mutation without downloading the entire workspace again. */
import type {
  Dataset,
  Habit,
  HabitLog,
  Profile,
  Segment,
  StudySession,
} from "@/types/models";

export type MutationResponse = {
  ok: true;
  habit?: Habit;
  log?: HabitLog;
  profile?: Profile;
  studyPatch?: { session: StudySession; segments: Segment[] };
};

type DeletePayload = {
  entity: "habits" | "habit_logs" | "study_sessions";
  id: string;
};

function replaceById<T extends { id: string }>(items: T[], updated: T): T[] {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index === -1) return [...items, updated];
  return items.map((item, i) => (i === index ? updated : item));
}

export function applyMutation(
  previous: Dataset,
  operation: string,
  payload: unknown,
  response: MutationResponse,
): Dataset {
  switch (operation) {
    case "habit":
      return response.habit
        ? { ...previous, habits: replaceById(previous.habits, response.habit) }
        : previous;
    case "log":
      return response.log
        ? { ...previous, logs: replaceById(previous.logs, response.log) }
        : previous;
    case "profile":
      return response.profile
        ? { ...previous, profile: response.profile }
        : previous;
    case "session":
    case "focus":
      return response.studyPatch
        ? {
            ...previous,
            sessions: replaceById(previous.sessions, response.studyPatch.session),
            segments: [
              ...previous.segments.filter(
                (segment) => segment.session_id !== response.studyPatch!.session.id,
              ),
              ...response.studyPatch.segments,
            ].sort((a, b) => a.started_at.localeCompare(b.started_at)),
          }
        : previous;
    case "delete": {
      const { entity, id } = payload as DeletePayload;
      if (entity === "habits") {
        return {
          ...previous,
          habits: previous.habits.filter((habit) => habit.id !== id),
          logs: previous.logs.filter((log) => log.habit_id !== id),
        };
      }
      if (entity === "habit_logs") {
        return { ...previous, logs: previous.logs.filter((log) => log.id !== id) };
      }
      if (entity === "study_sessions") {
        return {
          ...previous,
          sessions: previous.sessions.filter((session) => session.id !== id),
          segments: previous.segments.filter((segment) => segment.session_id !== id),
        };
      }
      return previous;
    }
    default:
      return previous;
  }
}
