import { redirect } from "next/navigation";
import { configured } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!configured()) redirect("/setup");
  const { error } = await searchParams;
  return (
    <>
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      <AuthForm />
    </>
  );
}
