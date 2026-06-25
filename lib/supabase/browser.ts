import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl, type SupabaseDb } from "@/lib/supabase/config";

/** Browser/client component Supabase client. */
export function createSupabaseBrowserClient(): SupabaseDb | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
