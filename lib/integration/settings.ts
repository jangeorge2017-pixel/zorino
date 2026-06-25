import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type IntegrationSettingField = {
  key: string;
  label: string;
  provider: string;
  isSecret: boolean;
  configured: boolean;
  hasDbValue: boolean;
  hasEnvValue: boolean;
};

export const INTEGRATION_SETTING_FIELDS: Omit<
  IntegrationSettingField,
  "configured" | "hasDbValue" | "hasEnvValue"
>[] = [
  { key: "ALIEXPRESS_APP_KEY", label: "AliExpress App Key", provider: "aliexpress", isSecret: false },
  { key: "ALIEXPRESS_APP_SECRET", label: "AliExpress App Secret", provider: "aliexpress", isSecret: true },
  { key: "ALIEXPRESS_TRACKING_ID", label: "AliExpress Tracking ID", provider: "aliexpress", isSecret: false },
  { key: "EBAY_APP_ID", label: "eBay App ID", provider: "ebay", isSecret: false },
  { key: "EBAY_CERT_ID", label: "eBay Cert ID", provider: "ebay", isSecret: true },
  { key: "EBAY_CAMPAIGN_ID", label: "eBay Campaign ID", provider: "ebay", isSecret: false },
  { key: "CJDROPSHIPPING_API_KEY", label: "CJdropshipping API Key", provider: "cjdropshipping", isSecret: true },
];

export async function getIntegrationSettingsStatus(): Promise<IntegrationSettingField[]> {
  const supabase = createSupabaseServiceClient();
  const dbValues = new Map<string, boolean>();

  if (supabase) {
    const { data } = await supabase.from("integration_settings").select("key, value");
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      dbValues.set(row.key, Boolean(row.value?.trim()));
    }
  }

  return INTEGRATION_SETTING_FIELDS.map((field) => {
    const hasEnvValue = Boolean(process.env[field.key]?.trim());
    const hasDbValue = dbValues.get(field.key) ?? false;
    return {
      ...field,
      hasEnvValue,
      hasDbValue,
      configured: hasEnvValue || hasDbValue,
    };
  });
}

export async function saveIntegrationSettings(
  values: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  const rows = INTEGRATION_SETTING_FIELDS.map((field) => {
    const value = values[field.key]?.trim();
    if (!value) return null;
    return {
      key: field.key,
      value,
      provider: field.provider,
      label: field.label,
      is_secret: field.isSecret,
      updated_at: new Date().toISOString(),
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return { ok: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("integration_settings").upsert(rows, {
    onConflict: "key",
  });
  if (error) return { ok: false, error: error.message };

  for (const row of rows) {
    process.env[row.key] = row.value;
  }

  return { ok: true };
}
