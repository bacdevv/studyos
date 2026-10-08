"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  LayoutDashboard,
  ListChecks,
  Timer,
  ChartNoAxesCombined,
  CalendarDays,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { browserClient } from "@/lib/supabase/browser";
import { localDate } from "@/lib/analytics";
import type { Dataset } from "@/types/models";
import { Dashboard, Stats, Trends } from "@/features/dashboard";
import { Habits, HabitForm } from "@/features/habits";
import { Study } from "@/features/study";
import { Settings } from "@/features/settings";
import { History } from "@/features/history";
import { Dialog } from "./ui/dialog";
import { ConfirmDelete } from "./ui/alert-dialog";
const nav = [
  { id: "dashboard", name: "Overview", icon: LayoutDashboard },
  { id: "habits", name: "Habit tracker", icon: ListChecks },
  { id: "study", name: "Study sessions", icon: Timer },
  { id: "analytics", name: "Analytics", icon: ChartNoAxesCombined },
  { id: "history", name: "Activity calendar", icon: CalendarDays },
];
const copy: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: "A little better, every day.",
    description: "Make time for the things you want to learn.",
  },
  habits: {
    title: "Consistency starts small.",
    description: "Give your good intentions a place in your day.",
  },
  study: {
    title: "Time well spent.",
    description: "A clear space to focus, learn and keep going.",
  },
  analytics: {
    title: "See how far you’ve come.",
    description: "Real progress, measured one day at a time.",
  },
  history: {
    title: "Your learning, in retrospect.",
    description: "A calendar of the days you showed up.",
  },
  settings: {
    title: "Make yourself at home.",
    description: "Your workspace, your rhythm.",
  },
};
export function Workspace({ section }: { section: string }) {
  const router = useRouter();
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const busyRef = useRef(false);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [date, setDate] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [create, setCreate] = useState(false);
  const [deleting, setDeleting] = useState<{
    entity: "habits" | "study_sessions" | "habit_logs";
    id: string;
  } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/data", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) router.replace("/login");
      throw new Error(result.error ?? "Unable to load data");
    }
    const dataset = result as Dataset;
    dataset.segments.sort((a, b) => a.started_at.localeCompare(b.started_at));
    return dataset;
  }, [router]);
  useEffect(() => {
    let live = true;
    load()
      .then((result) => {
        if (live) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!data) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        data.profile.theme === "dark" ||
          (data.profile.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data]);
  const mutate = async (type: string, payload: unknown) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setSaveFailed(false);
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data: payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save");
      setData(await load());
      setError("");
      toast.success(type === "delete" ? "Record deleted" : "Saved");
      return true;
    } catch (e) {
      setSaveFailed(true);
      toast.error(
        e instanceof Error ? e.message : "Connection lost. Please try again.",
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const today = localDate(now, data?.profile.timezone ?? "Asia/Ho_Chi_Minh");
  const selectedDate = date || today;
  const askDelete = (
    entity: "habits" | "study_sessions" | "habit_logs",
    id: string,
  ) => setDeleting({ entity, id });
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <span className="brand-label">StudyOS</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <div>
            Personal workspace<small>Your space to grow</small>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              href={`/${n.id}`}
              key={n.id}
              title={n.name}
              className={section === n.id ? "active" : ""}
              aria-current={section === n.id ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {section === n.id && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="eyebrow">KEEP SHOWING UP</span>
            <p>
              Small steps.
              <br />
              Lasting change.
            </p>
          </div>
          <Link
            href="/settings"
            className={`settings-link ${section === "settings" ? "active" : ""}`}
          >
            <SettingsIcon size={19} />
            <span>Settings</span>
          </Link>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose size={18} />
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {section === "settings"
                  ? "Settings"
                  : nav.find((n) => n.id === section)?.name}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="save-status" role="status">
              {busy
                ? "Saving…"
                : saveFailed
                  ? "Save failed — retry"
                  : data
                    ? "All changes saved"
                    : ""}
            </span>
            <span className="header-date">
              {format(parseISO(today), "EEE, MMM d")}
            </span>
            <details className="user-menu">
              <summary aria-label="Account menu">
                <span className="avatar">
                  {(data?.profile.display_name || data?.email || "S")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              </summary>
              <div>
                <small>{data?.email}</small>
                <Link href="/settings">Profile & preferences</Link>
                <button
                  onClick={async () => {
                    try {
                      const { error } = await browserClient().auth.signOut();
                      if (error) throw error;
                      router.replace("/login");
                      router.refresh();
                    } catch {
                      toast.error("Unable to sign out. Please retry.");
                    }
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {section === "dashboard"
                  ? `YOUR PERSONAL LEARNING SPACE`
                  : section.toUpperCase()}
              </span>
              <h1>{copy[section].title}</h1>
              <p>{copy[section].description}</p>
            </div>
            {section === "dashboard" && (
              <button
                className="button primary"
                disabled={!data}
                onClick={() => setCreate(true)}
              >
                <Plus size={17} />
                New habit
              </button>
            )}
          </div>
          {error ? (
            <section role="alert" className="card empty">
              <h2>We couldn’t load your workspace.</h2>
              <p>{error}</p>
              <button
                className="button"
                onClick={() =>
                  load()
                    .then((result) => {
                      setData(result);
                      setError("");
                    })
                    .catch((e) => setError(e.message))
                }
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </section>
          ) : !data ? (
            <div aria-busy="true" aria-label="Loading workspace">
              <div className="stats-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton stat-card" />
                ))}
              </div>
              <div className="skeleton skeleton-large" />
            </div>
          ) : (
            <>
              {section === "dashboard" && (
                <Dashboard
                  data={data}
                  today={today}
                  mutate={mutate}
                  busy={busy}
                  onDelete={askDelete}
                />
              )}{" "}
              {section === "habits" && (
                <Habits
                  data={data}
                  date={selectedDate}
                  setDate={setDate}
                  mutate={mutate}
                  busy={busy}
                  onDelete={askDelete}
                />
              )}{" "}
              {section === "study" && (
                <Study
                  data={data}
                  mutate={mutate}
                  busy={busy}
                  onDelete={askDelete}
                />
              )}{" "}
              {section === "analytics" && (
                <>
                  <Stats data={data} today={today} />
                  <Trends data={data} today={today} expanded />
                </>
              )}{" "}
              {section === "history" && <History data={data} today={today} />}{" "}
              {section === "settings" && (
                <Settings data={data} mutate={mutate} busy={busy} />
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              StudyOS <span>·</span> A little progress goes a long way.
            </span>
            <span>{data?.profile.timezone ?? "Asia/Ho_Chi_Minh"}</span>
          </footer>
        </main>
      </div>
      <Dialog
        open={create}
        onOpenChange={setCreate}
        title="Create a new habit"
        description="Build a routine around what matters to you."
      >
        {create && data && (
          <HabitForm
            today={today}
            count={data.habits.length}
            onSave={mutate}
            onClose={() => setCreate(false)}
          />
        )}
      </Dialog>
      <ConfirmDelete
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        busy={busy}
        onConfirm={async () => {
          if (deleting && (await mutate("delete", deleting))) setDeleting(null);
        }}
      />
    </div>
  );
}
