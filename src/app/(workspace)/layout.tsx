import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { configured, supabase } from "@/lib/supabase/server";
export default async function Protected({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/setup");
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect("/login");
  // The shared workspace stays mounted when the active section changes.
  return (
    <>
      <Workspace />
      {children}
    </>
  );
}
