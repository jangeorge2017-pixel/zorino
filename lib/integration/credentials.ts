import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Load integration API keys from DB into process.env for the current request. */
export async function hydrateIntegrationCredentials(): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  const { data } = await supabase.from("integration_settings").select("key, value");
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    if (row.value && !process.env[row.key]?.trim()) {
      process.env[row.key] = row.value;
    }
  }
}

export function getIntegrationCredential(key: string): string | undefined {
  const val = process.env[key]?.trim();
  return val || undefined;
}

export function isIntegrationConfigured(keys: string[]): boolean {
  return keys.every((key) => Boolean(getIntegrationCredential(key)));
}
