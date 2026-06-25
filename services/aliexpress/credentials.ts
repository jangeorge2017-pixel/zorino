import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import {
  AliExpressAffiliateClient,
  getAliExpressCredentialStatus,
  getAliExpressCredentials,
  type AliExpressValidationResult,
} from "@/lib/integrations/aliexpress";

export async function loadAliExpressCredentials(): Promise<void> {
  await hydrateIntegrationCredentials();
}

export function getAliExpressStatus() {
  return getAliExpressCredentialStatus();
}

export async function validateAliExpressCredentials(): Promise<AliExpressValidationResult> {
  await hydrateIntegrationCredentials();
  const creds = getAliExpressCredentials();
  if (!creds) {
    return {
      ok: false,
      message: "AliExpress App Key and App Secret are required.",
      testedAt: new Date().toISOString(),
    };
  }

  const client = new AliExpressAffiliateClient(
    creds.appKey,
    creds.appSecret,
    creds.trackingId
  );
  return client.validateCredentials();
}
