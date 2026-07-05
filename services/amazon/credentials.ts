import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";

/** Load Amazon PA-API credentials from env + Supabase integration_settings. */
export async function loadAmazonCredentials(): Promise<void> {
  await hydrateIntegrationCredentials();
}
