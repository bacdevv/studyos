"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowLeft } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
export function AuthForm({ reset = false }: { reset?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const db = browserClient();
      if (reset) {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      if (mode === "forgot") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        setMessage("If this account exists, a reset link has been sent.");
      } else if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else setMessage("Check your email to confirm your account.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          StudyOS<span className="beta">PERSONAL</span>
        </Link>
        <div>
          <span className="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
          <h1>
            Make room
            <br />
            for learning.
          </h1>
          <p>
            Your habits, study time and progress.
            <br />
            Together in one thoughtful workspace.
          </p>
          <div className="story-rule" />
          <small>Stay curious. Stay consistent.</small>
        </div>
        <small>Built for your next chapter.</small>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <span className="eyebrow">YOUR LEARNING WORKSPACE</span>
          <h2>
            {reset
              ? "Choose a new password"
              : mode === "signup"
                ? "Start your next chapter"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Welcome back"}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? "Create a private space for your daily progress."
              : "Small steps. Meaningful progress."}
          </p>
          {!reset && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </label>
          )}
          {(reset || mode !== "forgot") && (
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                placeholder="At least 8 characters"
                required
                autoComplete={
                  mode === "login" && !reset
                    ? "current-password"
                    : "new-password"
                }
              />
            </label>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy
              ? "Please wait…"
              : reset
                ? "Save password"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
          </button>
          {!reset && (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setMessage("");
                }}
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "New to StudyOS? Create an account"}
              </button>
              <button
                type="button"
                className="text-button muted"
                onClick={() => {
                  setMode(mode === "forgot" ? "login" : "forgot");
                  setMessage("");
                }}
              >
                {mode === "forgot" ? (
                  <>
                    <ArrowLeft size={14} /> Back to sign in
                  </>
                ) : (
                  "Forgot password?"
                )}
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}
