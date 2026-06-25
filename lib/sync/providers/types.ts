/**
 * Provider adapter credential and capability metadata.
 */

export type ImportProviderId = "amazon" | "aliexpress" | "cjdropshipping" | "ebay";

export interface ProviderCredentials {
  envKeys: string[];
  configured: boolean;
  missingKeys: string[];
}

export interface ProviderAdapterMeta {
  id: ImportProviderId;
  name: string;
  phase: "placeholder" | "live";
  apiDocs?: string;
}

export function checkProviderCredentials(envKeys: string[]): ProviderCredentials {
  const missingKeys = envKeys.filter((key) => !process.env[key]?.trim());
  return {
    envKeys,
    configured: missingKeys.length === 0,
    missingKeys,
  };
}
