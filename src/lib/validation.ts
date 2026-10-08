import { z } from "zod";
const date = z.iso.date();
export const habitSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["checkbox", "number", "duration", "measurement"]),
  target: z.number().positive().max(1e9),
  unit: z.string().trim().max(24),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start_date: date,
  archived: z.boolean(),
  position: z.number().int().min(-1000000).max(1000000),
});
export const logSchema = z.object({
  habit_id: z.uuid(),
  date,
  value: z.number().min(0).max(1e9),
});
export const sessionSchema = z
  .object({
    id: z.uuid(),
    subject: z.string().trim().min(1).max(100),
    note: z.string().max(2000),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
  })
  .refine(
    (v) =>
      Date.parse(v.end) > Date.parse(v.start) &&
      Date.parse(v.end) - Date.parse(v.start) <= 86400000,
    "Duration must be between 0 and 24 hours",
  );
export const focusSchema = z.object({
  id: z.uuid(),
  action: z.enum(["start", "pause", "resume", "finish"]),
  subject: z.string().trim().min(1).max(100),
});
export const profileSchema = z.object({
  display_name: z.string().trim().max(80),
  timezone: z.string().refine((v) => {
    try {
      Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone"),
  theme: z.enum(["light", "dark", "system"]),
  weekly_goal_minutes: z.number().int().min(1).max(10080),
});
export const deleteSchema = z.object({
  entity: z.enum(["habits", "study_sessions", "habit_logs"]),
  id: z.uuid(),
});
