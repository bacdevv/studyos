"use client";
import { useState } from "react";
import { Download, Save, ShieldCheck } from "lucide-react";
import { profileSchema } from "@/lib/validation";
import type { Dataset } from "@/types/models";
import type { Mutate } from "./habits";
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Settings({
  data,
  mutate,
  busy,
}: {
  data: Dataset;
  mutate: Mutate;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <h2>Your preferences</h2>
        <p className="muted">Make this workspace feel like yours.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            const v = profileSchema.safeParse({
              display_name: f.get("display_name"),
              timezone: f.get("timezone"),
              theme: f.get("theme"),
              weekly_goal_minutes: Number(f.get("goal")) * 60,
            });
            if (!v.success) {
              setError(v.error.issues[0].message);
              return;
            }
            await mutate("profile", v.data);
          }}
        >
          <label>
            Display name
            <input
              name="display_name"
              defaultValue={data.profile.display_name}
              maxLength={80}
              placeholder="Your name"
            />
          </label>
          <label>
            Timezone
            <input
              name="timezone"
              list="timezones"
              defaultValue={data.profile.timezone}
              required
            />
            <datalist id="timezones">
              {[
                "Asia/Ho_Chi_Minh",
                "Asia/Singapore",
                "Asia/Tokyo",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "UTC",
              ].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </datalist>
            <small className="muted">
              Daily totals follow this timezone, including midnight boundaries.
            </small>
          </label>
          <div className="form-grid">
            <label>
              Theme
              <select name="theme" defaultValue={data.profile.theme}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Weekly study goal (hours)
              <input
                name="goal"
                type="number"
                min="0.1"
                max="168"
                step="0.1"
                defaultValue={data.profile.weekly_goal_minutes / 60}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </form>
      </section>
      <div className="main-column">
        <section className="card settings-card">
          <h2>Your data belongs to you</h2>
          <p className="muted">
            Download all your saved records as JSON, or habit entries as a
            spreadsheet-friendly CSV.
          </p>
          <div className="form-stack">
            <button
              className="button"
              onClick={() =>
                download(
                  "studyos-export.json",
                  JSON.stringify(
                    {
                      version: 1,
                      exported_at: new Date().toISOString(),
                      ...data,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Export all data
            </button>
            <button
              className="button"
              onClick={() => {
                const cell = (v: unknown) => {
                  let s = String(v ?? "");
                  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
                  return '"' + s.replaceAll('"', '""') + '"';
                };
                download(
                  "studyos-habits.csv",
                  "\uFEFF" +
                    [
                      ["date", "habit", "value", "unit"],
                      ...data.logs.map((l) => {
                        const h = data.habits.find((h) => h.id === l.habit_id);
                        return [l.date, h?.name, l.value, h?.unit];
                      }),
                    ]
                      .map((row) => row.map(cell).join(","))
                      .join("\r\n"),
                  "text/csv;charset=utf-8",
                );
              }}
            >
              <Download size={16} />
              Export habit CSV
            </button>
          </div>
        </section>
        <section className="card settings-card privacy-card">
          <ShieldCheck size={24} />
          <h2>A private place to grow</h2>
          <p className="muted">
            Signed in as {data.email}. Records are scoped to your account with
            database access policies.
          </p>
          <p className="muted">
            Measurements are personal logs and do not provide medical advice.
          </p>
        </section>
      </div>
    </div>
  );
}
