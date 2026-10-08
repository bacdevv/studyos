"use client";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
import { applyMutation, type MutationResponse } from "@/lib/workspace-data";
import { HabitForm } from "@/features/habits";
// The larger views (especially charting) load only when first visited.
const Dashboard = dynamic(() => import("@/features/dashboard").then((m) => m.Dashboard));
const Stats = dynamic(() => import("@/features/dashboard").then((m) => m.Stats));
const Trends = dynamic(() => import("@/features/dashboard").then((m) => m.Trends));
const Habits = dynamic(() => import("@/features/habits").then((m) => m.Habits));
const Study = dynamic(() => import("@/features/study").then((m) => m.Study));
const Settings = dynamic(() => import("@/features/settings").then((m) => m.Settings));
const History = dynamic(() => import("@/features/history").then((m) => m.History));
// Preload feature chunks in idle time and on link hover/touch. This avoids a
// first-navigation waterfall, without triggering an authenticated RSC request.
function preloadFeature(section: string) {
  let task: Promise<unknown>;
  switch (section) {
    case "dashboard": case "analytics": task = import("@/features/dashboard"); break;
    case "habits": task = import("@/features/habits"); break;
    case "study": task = import("@/features/study"); break;
    case "history": task = import("@/features/history"); break;
    case "settings": task = import("@/features/settings"); break;
    default: return;
  }
  void task.catch(() => { /* The next navigation can retry the chunk. */ });
}
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
export function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const pathSection = pathname.split("/")[1];
  const section = Object.hasOwn(copy, pathSection) ? pathSection : "dashboard";
  // Next.js integrates the native History API with usePathname. Switching
  // between sections therefore needs no network request or layout remount.
  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.pathname !== path) window.history.pushState(null, "", path);
    setMobile(false);
  };
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
  // Don't re-render the entire workspace every 30 seconds when the day has
  // not changed. The Focus timer owns its own once-a-second clock.
  useEffect(() => {
    const tz = data?.profile.timezone ?? "Asia/Ho_Chi_Minh";
    const checkDay = () => setNow((previous) => {
      const current = new Date();
      return localDate(previous, tz) === localDate(current, tz) ? previous : current;
    });
    const id = setInterval(checkDay, 30000);
    const onVisible = () => { if (!document.hidden) checkDay(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data?.profile.timezone]);
  // Next/Link prefetch would run a server auth check for every link visible in
  // the sidebar; instead preload the JS chunks directly once we're idle.
  useEffect(() => {
    if (!data) return;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const preload = () => {
      preloadFeature("habits");
      preloadFeature("study");
      preloadFeature("history");
      preloadFeature("settings");
    };
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(preload, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(preload, 1000);
    }
    return () => {
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [data?.email]);
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
  const mutate = useCallback(async (type: string, payload: unknown) => {
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
      // The server returns only the confirmed updated record (or study data).
      // Keep the existing workspace in memory; never refetch all five tables.
      if (result.refreshRequired) {
        // Recover after a committed focus RPC if reading fresh rows failed.
        setData(await load());
      } else {
        setData((previous) =>
          previous ? applyMutation(previous, type, payload, result as MutationResponse) : previous,
        );
      }
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
  }, [load]);
  const today = localDate(now, data?.profile.timezone ?? "Asia/Ho_Chi_Minh");
  const selectedDate = date || today;
  const askDelete = useCallback((
    entity: "habits" | "study_sessions" | "habit_logs",
    id: string,
  ) => setDeleting({ entity, id }), []);
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link href="/dashboard" prefetch={false} className="brand" onClick={(event) => navigate(event, "/dashboard")}>
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
              prefetch={false}
              onMouseEnter={() => preloadFeature(n.id)}
              onFocus={() => preloadFeature(n.id)}
              onTouchStart={() => preloadFeature(n.id)}
              key={n.id}
              title={n.name}
              className={section === n.id ? "active" : ""}
              aria-current={section === n.id ? "page" : undefined}
              onClick={(event) => navigate(event, `/${n.id}`)}
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
            prefetch={false}
            onMouseEnter={() => preloadFeature("settings")}
            onFocus={() => preloadFeature("settings")}
            onTouchStart={() => preloadFeature("settings")}
            className={`settings-link ${section === "settings" ? "active" : ""}`}
            onClick={(event) => navigate(event, "/settings")}
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
                <Link href="/settings" onClick={(event) => navigate(event, "/settings")}>Profile & preferences</Link>
                <button
                  onClick={async () => {
                    try {
                      const { error } = await browserClient().auth.signOut();
                      if (error) throw error;
                      setData(null); // Never retain another account's private data.
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
              StudyOS <span>·</span> Speed v2 <span>·</span> A little progress goes a long way.
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
