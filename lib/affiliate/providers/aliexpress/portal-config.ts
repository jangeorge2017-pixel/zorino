/**
 * AliExpress Affiliate Portal configuration — environment variables only.
 * No hardcoded tracking IDs. No Open API credentials required for portal links.
 */

export const ALIEXPRESS_PORTAL_ENV = {
  TRACKING_ID: "ALIEXPRESS_TRACKING_ID",
  AFFILIATE_BASE_URL: "ALIEXPRESS_AFFILIATE_BASE_URL",
} as const;

export type AliExpressPortalConfig = {
  trackingId: string | null;
  affiliateBaseUrl: string | null;
  /** True when tracking ID is present (portal linking can run). */
  configured: boolean;
  warnings: string[];
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Read portal affiliate config from process.env (runtime). */
export function getAliExpressPortalConfig(): AliExpressPortalConfig {
  const trackingId = readEnv(ALIEXPRESS_PORTAL_ENV.TRACKING_ID);
  const affiliateBaseUrl = readEnv(ALIEXPRESS_PORTAL_ENV.AFFILIATE_BASE_URL);
  const warnings: string[] = [];

  if (!trackingId) {
    warnings.push(
      `${ALIEXPRESS_PORTAL_ENV.TRACKING_ID} is not set — AliExpress links will use the original product URL.`,
    );
  }

  if (affiliateBaseUrl) {
    try {
      const parsed = new URL(affiliateBaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        warnings.push(
          `${ALIEXPRESS_PORTAL_ENV.AFFILIATE_BASE_URL} must be an http(s) URL — ignoring base URL.`,
        );
        return {
          trackingId,
          affiliateBaseUrl: null,
          configured: Boolean(trackingId),
          warnings,
        };
      }
    } catch {
      warnings.push(
        `${ALIEXPRESS_PORTAL_ENV.AFFILIATE_BASE_URL} is not a valid URL — ignoring base URL.`,
      );
      return {
        trackingId,
        affiliateBaseUrl: null,
        configured: Boolean(trackingId),
        warnings,
      };
    }
  }

  return {
    trackingId,
    affiliateBaseUrl,
    configured: Boolean(trackingId),
    warnings,
  };
}

let didLogValidation = false;

/** Runtime validation — logs missing env once per process (server-side). */
export function validateAliExpressPortalEnv(): AliExpressPortalConfig {
  const config = getAliExpressPortalConfig();
  if (!didLogValidation && config.warnings.length > 0) {
    didLogValidation = true;
    for (const warning of config.warnings) {
      console.warn(`[affiliate:aliexpress] ${warning}`);
    }
  }
  return config;
}
