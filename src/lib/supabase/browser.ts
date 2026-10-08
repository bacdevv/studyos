import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/models";
export const browserClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
