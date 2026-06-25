import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
  type SupabaseDb,
} from "@/lib/supabase/config";

/** Server Component / Route Handler client (cookie-aware). */
export async function createSupabaseServerClient(): Promise<SupabaseDb | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* setAll from Server Component — safe to ignore */
        }
      },
    },
  });
}

/** Service-role client for scripts / trusted server jobs only. */
export function createSupabaseServiceClient(): SupabaseDb | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Generic anon client (no cookies) — useful for read-only server fetches. */
export function createSupabaseAnonClient(): SupabaseDb | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
