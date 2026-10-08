import { NextRequest, NextResponse } from "next/server";
import { supabase, configured } from "@/lib/supabase/server";
import {
  habitSchema,
  logSchema,
  sessionSchema,
  focusSchema,
  profileSchema,
  deleteSchema,
} from "@/lib/validation";
import type { Database } from "@/types/models";
export const dynamic = "force-dynamic";
function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
async function authorized() {
  if (!configured()) throw new Error("Supabase is not configured");
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return { db, user: data.user };
}
/** Paginate with Supabase's 1,000-row default limit in mind. */
async function all(
  db: Awaited<ReturnType<typeof supabase>>,
  table: keyof Database["public"]["Tables"],
) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function studyRows(db: Awaited<ReturnType<typeof supabase>>) {
  const [sessions, segments] = await Promise.all([
    all(db, "study_sessions"),
    all(db, "study_segments"),
  ]);
  return { sessions, segments };
}

export async function GET() {
  const started = performance.now();
  try {
    const auth = await authorized();
    const authorizedAt = performance.now();
    if (!auth) return fail("Please sign in", 401);
    const { db, user } = auth;
    const { error: initError } = await db
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (initError) throw initError;
    const [habits, logs, study, profile] = await Promise.all([
      all(db, "habits"),
      all(db, "habit_logs"),
      studyRows(db),
      db.from("profiles").select("*").eq("id", user.id).single(),
    ]);
    if (profile.error) throw profile.error;
    const finished = performance.now();
    return NextResponse.json(
      { habits, logs, ...study, profile: profile.data, email: user.email },
      { headers: {
        "Cache-Control": "private, no-store",
        "X-StudyOS-Version": "speed-v2",
        "Server-Timing": `auth;dur=${(authorizedAt - started).toFixed(1)}, data;dur=${(finished - authorizedAt).toFixed(1)}`,
      } },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to load your data", 500);
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin)
      return fail("Invalid origin", 403);
    const auth = await authorized();
    if (!auth) return fail("Please sign in", 401);
    const { db, user } = auth;
    const body = await request.json();
    let error: { code?: string; message: string } | null = null;
    const result: Record<string, unknown> = { ok: true };
    let changedSessionId: string | null = null;
    switch (body.type) {
      case "habit": {
        const row = habitSchema.parse(body.data);
        const updated = await db
          .from("habits")
          .upsert({ ...row, user_id: user.id })
          .select("*")
          .single();
        error = updated.error;
        if (updated.data) result.habit = updated.data;
        break;
      }
      case "log": {
        const row = logSchema.parse(body.data);
        const updated = await db
          .from("habit_logs")
          .upsert(
            { ...row, user_id: user.id },
            { onConflict: "habit_id,date" },
          )
          .select("*")
          .single();
        error = updated.error;
        if (updated.data) result.log = updated.data;
        break;
      }
      case "session": {
        const row = sessionSchema.parse(body.data);
        changedSessionId = row.id;
        ({ error } = await db.rpc("save_manual_session", {
          p_id: row.id,
          p_subject: row.subject,
          p_note: row.note,
          p_start: row.start,
          p_end: row.end,
        }));
        break;
      }
      case "focus": {
        const row = focusSchema.parse(body.data);
        changedSessionId = row.id;
        ({ error } = await db.rpc("focus_transition", {
          p_id: row.id,
          p_action: row.action,
          p_subject: row.subject,
        }));
        break;
      }
      case "profile": {
        const row = profileSchema.parse(body.data);
        const updated = await db
          .from("profiles")
          .update(row)
          .eq("id", user.id)
          .select("*")
          .single();
        error = updated.error;
        if (updated.data) result.profile = updated.data;
        break;
      }
      case "delete": {
        const row = deleteSchema.parse(body.data);
        ({ error } = await db
          .from(row.entity)
          .delete()
          .eq("id", row.id)
          .eq("user_id", user.id));
        break;
      }
      default:
        return fail("Unknown operation");
    }
    if (error) {
      if (error.code === "23P01")
        return fail(
          "This time overlaps an existing session. Choose another time.",
        );
      if (error.code === "23505")
        return fail(
          "A focus session is already active. Refresh to continue it.",
        );
      return fail(error.message);
    }
    if (changedSessionId) {
      try {
        // Only read the changed session and its segments. Other history stays
        // cached on the client, even if the user has thousands of sessions.
        const [session, segments] = await Promise.all([
          db.from("study_sessions").select("*").eq("id", changedSessionId).single(),
          db.from("study_segments").select("*").eq("session_id", changedSessionId),
        ]);
        if (session.error) throw session.error;
        if (segments.error) throw segments.error;
        result.studyPatch = { session: session.data, segments: segments.data };
      } catch {
        // The RPC has already committed. Never misreport it as a failed save.
        result.refreshRequired = true;
      }
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to save");
  }
}
