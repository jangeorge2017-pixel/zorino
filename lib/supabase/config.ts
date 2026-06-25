import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export type SupabaseDb = SupabaseClient<Database>;

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when public Supabase env vars are configured with real values. */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes("your-project-ref") || supabaseAnonKey === "your-anon-key") {
    return false;
  }
  return true;
}
