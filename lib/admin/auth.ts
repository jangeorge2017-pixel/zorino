import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/entities";

export async function getAdminUser(): Promise<User | null> {
  const { data: user, error } = await getCurrentUser();
  if (error || !user?.isAdmin) return null;
  return user;
}

export async function requireAdmin(locale = "en"): Promise<User> {
  const user = await getAdminUser();
  if (!user) {
    const prefix = locale === "en" ? "" : `/${locale}`;
    redirect(`${prefix}/admin/login`);
  }
  return user;
}

export async function getAdminSupabaseClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}
