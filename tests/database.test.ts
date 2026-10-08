import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const habit = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function as(user: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610080001_studyos.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL migration, RLS and transactions", () => {
  it("owner can create and read a habit", async () => {
    await as(a);
    await db.exec(
      `insert into public.habits(id,user_id,name,kind) values('${habit}','${a}','Reading','checkbox')`,
    );
    expect((await db.query("select * from public.habits")).rows).toHaveLength(
      1,
    );
  });
  it("another user cannot read, update or delete that habit", async () => {
    await as(b);
    expect((await db.query("select * from public.habits")).rows).toHaveLength(
      0,
    );
    await db.exec(
      `update public.habits set name='attack' where id='${habit}';delete from public.habits where id='${habit}';`,
    );
    await as(a);
    expect(
      (await db.query<{ name: string }>("select name from public.habits"))
        .rows[0].name,
    ).toBe("Reading");
  });
  it("forged ownership is rejected", async () => {
    await as(b);
    await expect(
      db.exec(
        `insert into public.habits(user_id,name,kind) values('${a}','forged','checkbox')`,
      ),
    ).rejects.toThrow();
  });
  it("cross-owner foreign key is rejected", async () => {
    await as(b);
    await expect(
      db.exec(
        `insert into public.habit_logs(user_id,habit_id,date,value) values('${b}','${habit}','2026-10-08',1)`,
      ),
    ).rejects.toThrow();
  });
  it("duplicate daily habit entries are constrained", async () => {
    await as(a);
    await db.exec(
      `insert into public.habit_logs(user_id,habit_id,date,value) values('${a}','${habit}','2026-10-08',1)`,
    );
    await expect(
      db.exec(
        `insert into public.habit_logs(user_id,habit_id,date,value) values('${a}','${habit}','2026-10-08',1)`,
      ),
    ).rejects.toThrow();
  });
  it("manual retries are idempotent and overlaps are rejected atomically", async () => {
    await as(a);
    const id = "44444444-4444-4444-8444-444444444444";
    const query = `select public.save_manual_session('${id}','ML','','2025-01-01T01:00:00Z','2025-01-01T02:00:00Z')`;
    await db.exec(query);
    await db.exec(query);
    expect(
      (await db.query("select * from public.study_segments")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `select public.save_manual_session('55555555-5555-4555-8555-555555555555','Overlap','','2025-01-01T01:30:00Z','2025-01-01T02:30:00Z')`,
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.study_sessions")).rows,
    ).toHaveLength(1);
  });
  it("focus transitions preserve pause/resume and retry safely", async () => {
    await as(a);
    const id = "66666666-6666-4666-8666-666666666666";
    await db.exec(
      `select public.focus_transition('${id}','start','Java');select public.focus_transition('${id}','start','Java');`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    await db.exec(
      `select public.focus_transition('${id}','pause','Java');select public.focus_transition('${id}','pause','Java');`,
    );
    expect(
      (
        await db.query<{ status: string }>(
          `select status from public.study_sessions where id='${id}'`,
        )
      ).rows[0].status,
    ).toBe("paused");
    await db.exec(`select public.focus_transition('${id}','resume','Java');`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await db.exec(
      `select public.focus_transition('${id}','finish','Java');select public.focus_transition('${id}','finish','Java');`,
    );
    expect(
      (
        await db.query(
          `select * from public.study_segments where session_id='${id}'`,
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("session records and segments remain private", async () => {
    await as(b);
    expect(
      (await db.query("select * from public.study_sessions")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.study_segments")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `select public.focus_transition('66666666-6666-4666-8666-666666666666','finish','Java')`,
      ),
    ).rejects.toThrow();
  });
  it("anonymous users cannot read personal data", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from public.habits")).rejects.toThrow();
  });
});
