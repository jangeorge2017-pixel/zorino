import type { EbayCredentials, EbayCredentialStatus } from "@/lib/integrations/ebay/types";
import { getIntegrationCredential } from "@/lib/integration/credentials";

export const EBAY_CREDENTIAL_KEYS = {
  APP_ID: "EBAY_APP_ID",
  CERT_ID: "EBAY_CERT_ID",
  CAMPAIGN_ID: "EBAY_CAMPAIGN_ID",
  OAUTH_TOKEN: "EBAY_OAUTH_TOKEN",
} as const;

export const EBAY_PROVIDER_ID = "ebay" as const;

/** Accept common Vercel/dashboard key aliases for Client ID. */
const EBAY_APP_ID_ALIASES = ["EBAY_APP_ID", "EBAY_CLIENT_ID", "EBAY_Client_ID"] as const;

function resolveEbayAppId(): string | undefined {
  for (const key of EBAY_APP_ID_ALIASES) {
    const val = getIntegrationCredential(key);
    if (val) return val;
  }
  return undefined;
}

function resolveEbayCertId(): string | undefined {
  return (
    getIntegrationCredential(EBAY_CREDENTIAL_KEYS.CERT_ID) ??
    getIntegrationCredential("EBAY_CLIENT_SECRET") ??
    getIntegrationCredential("EBAY_Client_Secret")
  );
}

const EBAY_PRODUCTION = {
  browseApi: "https://api.ebay.com/buy/browse/v1",
  tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
} as const;

const EBAY_SANDBOX_ENDPOINTS = {
  browseApi: "https://api.sandbox.ebay.com/buy/browse/v1",
  tokenUrl: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
} as const;

/** True when sandbox Browse/OAuth endpoints should be used. */
export function isEbaySandboxMode(): boolean {
  const flag = getIntegrationCredential("EBAY_SANDBOX")?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;

  const appId = resolveEbayAppId() ?? "";
  const certId = resolveEbayCertId() ?? "";
  return appId.includes("-SBX-") || certId.startsWith("SBX-");
}

export function getEbayBrowseApiBase(): string {
  return isEbaySandboxMode() ? EBAY_SANDBOX_ENDPOINTS.browseApi : EBAY_PRODUCTION.browseApi;
}

export function getEbayTokenUrl(): string {
  return isEbaySandboxMode() ? EBAY_SANDBOX_ENDPOINTS.tokenUrl : EBAY_PRODUCTION.tokenUrl;
}

/** @deprecated Use getEbayBrowseApiBase() — kept for backward compatibility. */
export const EBAY_BROWSE_API = EBAY_PRODUCTION.browseApi;
/** @deprecated Use getEbayTokenUrl() — kept for backward compatibility. */
export const EBAY_TOKEN_URL = EBAY_PRODUCTION.tokenUrl;

export function getEbayCredentialStatus(): EbayCredentialStatus {
  const appId = resolveEbayAppId();
  const certId = resolveEbayCertId();
  const campaignId = getIntegrationCredential(EBAY_CREDENTIAL_KEYS.CAMPAIGN_ID);
  const oauthToken = getIntegrationCredential(EBAY_CREDENTIAL_KEYS.OAUTH_TOKEN);
  const referenceId = getIntegrationCredential("EBAY_REFERENCE_ID");

  const hasOauthToken = Boolean(oauthToken);
  const hasAppId = Boolean(appId);
  const hasCertId = Boolean(certId);
  const configured = hasOauthToken || (hasAppId && hasCertId);

  let source: EbayCredentialStatus["source"] = "none";
  if (configured) {
    source = process.env[EBAY_CREDENTIAL_KEYS.APP_ID]?.trim() ? "env" : "database";
  }

  return {
    configured,
    hasAppId,
    hasCertId,
    hasCampaignId: Boolean(campaignId),
    hasOauthToken,
    hasReferenceId: Boolean(referenceId),
    source,
  };
}

export function getEbayCredentials(): EbayCredentials | null {
  const oauthToken = getIntegrationCredential(EBAY_CREDENTIAL_KEYS.OAUTH_TOKEN);
  const appId = resolveEbayAppId();
  const certId = resolveEbayCertId();

  if (oauthToken) {
    return {
      appId: appId ?? "",
      certId: certId ?? "",
      oauthToken,
      campaignId: getIntegrationCredential(EBAY_CREDENTIAL_KEYS.CAMPAIGN_ID),
    };
  }

  if (!appId || !certId) return null;

  return {
    appId,
    certId,
    campaignId: getIntegrationCredential(EBAY_CREDENTIAL_KEYS.CAMPAIGN_ID),
  };
}

export function isEbayConfigured(): boolean {
  return getEbayCredentialStatus().configured;
}
