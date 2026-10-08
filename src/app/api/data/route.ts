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
export async function GET() {
  try {
    const auth = await authorized();
    if (!auth) return fail("Please sign in", 401);
    const { db, user } = auth;
    async function all<T extends keyof Database["public"]["Tables"]>(table: T) {
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
    const { error: initError } = await db
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (initError) throw initError;
    const [habits, logs, sessions, segments, profile] = await Promise.all([
      all("habits"),
      all("habit_logs"),
      all("study_sessions"),
      all("study_segments"),
      db.from("profiles").select("*").eq("id", user.id).single(),
    ]);
    if (profile.error) throw profile.error;
    return NextResponse.json(
      {
        habits,
        logs,
        sessions,
        segments,
        profile: profile.data,
        email: user.email,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(
      e instanceof Error ? e.message : "Unable to load your data",
      500,
    );
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
    let error = null;
    switch (body.type) {
      case "habit": {
        const row = habitSchema.parse(body.data);
        ({ error } = await db
          .from("habits")
          .upsert({ ...row, user_id: user.id }));
        break;
      }
      case "log": {
        const row = logSchema.parse(body.data);
        ({ error } = await db
          .from("habit_logs")
          .upsert(
            { ...row, user_id: user.id },
            { onConflict: "habit_id,date" },
          ));
        break;
      }
      case "session": {
        const row = sessionSchema.parse(body.data);
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
        ({ error } = await db.rpc("focus_transition", {
          p_id: row.id,
          p_action: row.action,
          p_subject: row.subject,
        }));
        break;
      }
      case "profile": {
        const row = profileSchema.parse(body.data);
        ({ error } = await db.from("profiles").update(row).eq("id", user.id));
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to save");
  }
}
