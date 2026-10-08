import Link from "next/link";
import { BookOpen, Database, ShieldCheck, Terminal } from "lucide-react";
export default function Setup() {
  return (
    <main className="setup-page">
      <div className="brand">
        <span className="brand-mark">
          <BookOpen />
        </span>
        StudyOS
      </div>
      <section className="setup-card">
        <span className="eyebrow">READY FOR YOUR WORKSPACE</span>
        <h1>Connect your private data.</h1>
        <p className="muted">
          StudyOS needs your Supabase project before you can sign in and start
          tracking.
        </p>
        <ol className="setup-steps">
          <li>
            <Database />
            <div>
              <strong>1. Create a Supabase project</strong>
              <p>
                Run <code>supabase/migrations/202610080001_studyos.sql</code> in
                its SQL editor.
              </p>
            </div>
          </li>
          <li>
            <Terminal />
            <div>
              <strong>2. Add your environment variables</strong>
              <p>
                Copy <code>.env.example</code> to <code>.env.local</code>. Add
                the project URL and publishable key, then restart the app.
              </p>
            </div>
          </li>
          <li>
            <ShieldCheck />
            <div>
              <strong>3. Configure authentication</strong>
              <p>
                Add your site URL and <code>/auth/callback</code> to the allowed
                redirect URLs. The README includes exact steps.
              </p>
            </div>
          </li>
        </ol>
        <Link href="/login" className="button primary">
          Continue to sign in
        </Link>
        <p className="fine-print">
          Your dashboard starts empty. All progress comes from records you save.
        </p>
      </section>
    </main>
  );
}
