export type Habit = {
  id: string;
  user_id: string;
  name: string;
  kind: "checkbox" | "number" | "duration" | "measurement";
  target: number;
  unit: string;
  days: number[];
  start_date: string;
  archived: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};
export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number;
  created_at: string;
  updated_at: string;
};
export type StudySession = {
  id: string;
  user_id: string;
  subject: string;
  note: string;
  status: "running" | "paused" | "completed";
  active_since: string | null;
  created_at: string;
  updated_at: string;
};
export type Segment = {
  id: string;
  session_id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
};
export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  theme: "light" | "dark" | "system";
  weekly_goal_minutes: number;
  created_at: string;
  updated_at: string;
};
export type Dataset = {
  habits: Habit[];
  logs: HabitLog[];
  sessions: StudySession[];
  segments: Segment[];
  profile: Profile;
  email: string;
};
type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      habits: Table<Habit>;
      habit_logs: Table<HabitLog>;
      study_sessions: Table<StudySession>;
      study_segments: Table<Segment>;
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      focus_transition: {
        Args: { p_id: string; p_action: string; p_subject: string };
        Returns: undefined;
      };
      save_manual_session: {
        Args: {
          p_id: string;
          p_subject: string;
          p_note: string;
          p_start: string;
          p_end: string;
        };
        Returns: undefined;
      };
    };
  };
};
