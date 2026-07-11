/**
 * eBay Partner Network (EPN) preparation layer.
 *
 * This module documents required credentials, validates readiness, and exposes
 * placeholder keys. It does NOT activate live EPN traffic — production remains
 * idle until credentials are saved and validated in Admin → Marketplaces.
 *
 * @see https://partnernetwork.ebay.com/
 * @see https://developer.ebay.com/api-docs/buy/static/api-browse.html
 */

import type { EbayCredentialStatus } from "@/lib/integrations/ebay/types";
import {
  EBAY_CREDENTIAL_KEYS,
  getEbayCredentialStatus,
  isEbayConfigured,
} from "@/lib/integrations/ebay/config";

/** All env / integration_settings keys used by the eBay + EPN stack. */
export const EBAY_EPN_CREDENTIAL_KEYS = {
  ...EBAY_CREDENTIAL_KEYS,
  /** Optional sub-tracking ID (maps to affiliateReferenceId / customid). */
  REFERENCE_ID: "EBAY_REFERENCE_ID",
  /** Set to "true" to use sandbox endpoints when EPN goes live (not active yet). */
  SANDBOX: "EBAY_SANDBOX",
} as const;

export type EbayEpnCredentialSlot = {
  key: string;
  label: string;
  required: boolean;
  purpose: "oauth" | "affiliate" | "optional";
  placeholder: string;
};

/** Credential slots shown in admin and documented in .env.example. */
export const EBAY_EPN_CREDENTIAL_SLOTS: EbayEpnCredentialSlot[] = [
  {
    key: EBAY_EPN_CREDENTIAL_KEYS.APP_ID,
    label: "App ID (Client ID)",
    required: true,
    purpose: "oauth",
    placeholder: "YourProductionApp-PRD-xxxxxxxx-xxxx-xxxx",
  },
  {
    key: EBAY_EPN_CREDENTIAL_KEYS.CERT_ID,
    label: "Cert ID (Client Secret)",
    required: true,
    purpose: "oauth",
    placeholder: "PRD-xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
  {
    key: EBAY_EPN_CREDENTIAL_KEYS.CAMPAIGN_ID,
    label: "Campaign ID (ePN)",
    required: true,
    purpose: "affiliate",
    placeholder: "5338734567",
  },
  {
    key: EBAY_EPN_CREDENTIAL_KEYS.OAUTH_TOKEN,
    label: "OAuth Token (optional preset)",
    required: false,
    purpose: "optional",
    placeholder: "Leave empty to use client-credentials flow",
  },
  {
    key: EBAY_EPN_CREDENTIAL_KEYS.REFERENCE_ID,
    label: "Reference ID (optional sub-tracking)",
    required: false,
    purpose: "optional",
    placeholder: "zorino-ebay-ref",
  },
];

export type EbayEpnPrepStatus = {
  /** True when OAuth credentials exist (app+cert or preset token). */
  apiReady: boolean;
  /** True when ePN Campaign ID is present. */
  affiliateReady: boolean;
  /** True when both API and affiliate slots are filled. */
  fullyReady: boolean;
  /** True when Browse search can run in production (API credentials present). */
  liveEnabled: boolean;
  credentialStatus: EbayCredentialStatus;
  missingRequired: string[];
  optionalPresent: string[];
  marketplaceEngineCompatible: true;
  affiliateArchitecture: {
    browseApi: string;
    affiliateHeader: "X-EBAY-C-ENDUSERCTX";
    linkService: "services/ebay/affiliate-links";
    adminPanel: "/admin/marketplaces";
    universalEngineProvider: "ebay";
  };
};

function slotConfigured(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

/**
 * Read-only EPN readiness audit. Does not call eBay APIs or enable imports.
 */
export function getEbayEpnPrepStatus(): EbayEpnPrepStatus {
  const credentialStatus = getEbayCredentialStatus();
  const required = EBAY_EPN_CREDENTIAL_SLOTS.filter((s) => s.required);
  const optional = EBAY_EPN_CREDENTIAL_SLOTS.filter((s) => !s.required);

  const missingRequired = required
    .filter((s) => {
      if (s.key === EBAY_EPN_CREDENTIAL_KEYS.APP_ID) return !credentialStatus.hasAppId;
      if (s.key === EBAY_EPN_CREDENTIAL_KEYS.CERT_ID) return !credentialStatus.hasCertId;
      if (s.key === EBAY_EPN_CREDENTIAL_KEYS.CAMPAIGN_ID) return !credentialStatus.hasCampaignId;
      return !slotConfigured(s.key);
    })
    .map((s) => s.key);

  const optionalPresent = optional.filter((s) => slotConfigured(s.key)).map((s) => s.key);

  const apiReady = isEbayConfigured();
  const affiliateReady = credentialStatus.hasCampaignId;

  return {
    apiReady,
    affiliateReady,
    fullyReady: apiReady && affiliateReady,
    liveEnabled: apiReady,
    credentialStatus,
    missingRequired,
    optionalPresent,
    marketplaceEngineCompatible: true,
    affiliateArchitecture: {
      browseApi: "https://api.ebay.com/buy/browse/v1",
      affiliateHeader: "X-EBAY-C-ENDUSERCTX",
      linkService: "services/ebay/affiliate-links",
      adminPanel: "/admin/marketplaces",
      universalEngineProvider: "ebay",
    },
  };
}

/** Keys accepted by admin save for eBay / EPN (placeholders only until go-live). */
export const EBAY_EPN_ADMIN_SAVE_KEYS = [
  EBAY_EPN_CREDENTIAL_KEYS.APP_ID,
  EBAY_EPN_CREDENTIAL_KEYS.CERT_ID,
  EBAY_EPN_CREDENTIAL_KEYS.CAMPAIGN_ID,
  EBAY_EPN_CREDENTIAL_KEYS.OAUTH_TOKEN,
  EBAY_EPN_CREDENTIAL_KEYS.REFERENCE_ID,
] as const;
