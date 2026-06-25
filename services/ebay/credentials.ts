import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import {
  EbayAffiliateClient,
  getEbayCredentialStatus,
  getEbayCredentials,
  type EbayValidationResult,
} from "@/lib/integrations/ebay";

export async function loadEbayCredentials(): Promise<void> {
  await hydrateIntegrationCredentials();
}

export function getEbayStatus() {
  return getEbayCredentialStatus();
}

export async function validateEbayCredentials(): Promise<EbayValidationResult> {
  await hydrateIntegrationCredentials();
  const creds = getEbayCredentials();
  if (!creds) {
    return {
      ok: false,
      message: "eBay App ID and Cert ID (or OAuth token) are required.",
      testedAt: new Date().toISOString(),
    };
  }

  const client = new EbayAffiliateClient(creds.campaignId);
  return client.validateCredentials();
}
