export type EbayCredentials = {
  appId: string;
  certId: string;
  campaignId?: string;
  oauthToken?: string;
};

export type EbayCredentialStatus = {
  configured: boolean;
  hasAppId: boolean;
  hasCertId: boolean;
  hasCampaignId: boolean;
  hasOauthToken: boolean;
  source: "env" | "database" | "none";
};

export type EbayValidationResult = {
  ok: boolean;
  message: string;
  testedAt: string;
};

export type EbayRawProduct = {
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  shortDescription?: string;
  condition?: string;
  seller?: { username?: string };
  estimatedAvailabilities?: { estimatedAvailableQuantity?: number }[];
  buyingOptions?: string[];
};

export type EbaySyncJobKind = "products" | "prices" | "stock" | "images" | "full";

export type ImportEventLevel = "info" | "warn" | "error";

export type ImportEventLog = {
  id: string;
  provider: string;
  jobType: string;
  level: ImportEventLevel;
  message: string;
  metadata: Record<string, unknown>;
  syncRunId: string | null;
  createdAt: string;
};
