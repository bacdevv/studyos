import { redirect } from "next/navigation";
import { configured, supabase } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
export default async function Page() {
  if (!configured()) redirect("/setup");
  const db = await supabase();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  return <AuthForm reset />;
}
