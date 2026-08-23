/**
 * Admitad multi-merchant discovery.
 *
 * Discovers ALL affiliate programs connected/approved for the publisher's
 * ad spaces via the real Admitad Publisher API:
 *   1. GET /websites/                      — publisher ad spaces
 *   2. GET /advcampaigns/website/{w_id}/   — connected programs (paginated)
 *   3. Filter connection_status=active AND status=active
 *   4. Collect every product feed URL (feeds_info[].xml_link),
 *      deeplink support (allow_deeplink), standard affiliate link (gotolink)
 *
 * Results are cached in-memory for a short TTL so click-time deeplink
 * generation does not hammer the API (rate limit: 100 req/min).
 */

import {
  listCampaignsForWebsite,
  listWebsites,
  type AdmitadCampaign,
} from "./api";
import { getAccessToken } from "./auth";
import { generateDeeplink } from "./api";

export type AdmitadMerchantProgram = {
  /** Admitad campaign/program ID */
  campaignId: number;
  /** Publisher ad-space (website) ID the program is connected to */
  websiteId: number;
  /** Program/merchant display name as reported by Admitad */
  merchantName: string;
  /** Primary product feed URL (https) — null when the program has no feed */
  feedUrl: string | null;
  /** Every declared product feed URL for the program */
  feedUrls: string[];
  /** Standard affiliate/gotolink URL (for programs without deeplinks) */
  gotolink: string | null;
  /** Whether the Admitad deeplink generator supports this program */
  canGenerateDeeplinks: boolean;
  /** Connection status as reported by Admitad ("active" = approved) */
  connectionStatus: string;
  /** Targeted regions (empty array = unrestricted/WW) */
  geoRestrictions: string[];
  /** Program categories */
  categories: string[];
  /** Program currency */
  currency: string;
  /** Merchant site URL */
  siteUrl: string;
};

export type MerchantDiscoveryResult = {
  authenticated: boolean;
  websitesChecked: number;
  programsConnected: number;
  activeMerchantPrograms: AdmitadMerchantProgram[];
  errors: string[];
};

function toHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^http:\/\//i, "https://");
}

function campaignToProgram(campaign: AdmitadCampaign, websiteId: number): AdmitadMerchantProgram {
  const feedUrls = (campaign.feeds_info ?? [])
    .map((f) => toHttps(f.xml_link))
    .filter((u): u is string => Boolean(u));

  return {
    campaignId: campaign.id,
    websiteId,
    merchantName: campaign.name,
    feedUrl: feedUrls[0] ?? toHttps(campaign.products_xml_link),
    feedUrls,
    gotolink: toHttps(campaign.gotolink),
    canGenerateDeeplinks: Boolean(campaign.allow_deeplink),
    connectionStatus: campaign.connection_status ?? campaign.status,
    geoRestrictions: (campaign.regions ?? []).map((r) => r.region),
    categories: (campaign.categories ?? []).map((c) => c.name),
    currency: campaign.currency,
    siteUrl: campaign.site_url,
  };
}

/** Discover all active connected merchant programs across every ad space. */
export async function discoverAdmitadMerchants(
  _options: { maxFeeds?: number; maxProductsPerFeed?: number } = {},
): Promise<MerchantDiscoveryResult> {
  const result: MerchantDiscoveryResult = {
    authenticated: false,
    websitesChecked: 0,
    programsConnected: 0,
    activeMerchantPrograms: [],
    errors: [],
  };

  // 1. Authenticate (throws when ADMITAD_CLIENT_ID/SECRET are missing/invalid)
  await getAccessToken();
  result.authenticated = true;

  // 2. Discover ad spaces
  const websites = await listWebsites();
  result.websitesChecked = websites.length;

  // 3. Connected programs per ad space (real pagination inside the client)
  for (const website of websites) {
    try {
      const campaigns = await listCampaignsForWebsite(website.id);
      result.programsConnected += campaigns.length;

      for (const campaign of campaigns) {
        const isActive =
          campaign.connection_status === "active" &&
          (campaign.status === "active" || !campaign.status);
        if (!isActive) continue;
        result.activeMerchantPrograms.push(campaignToProgram(campaign, website.id));
      }
    } catch (err) {
      result.errors.push(
        `Programs for website ${website.id} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  console.log(
    `[admitad-discovery] websites=${result.websitesChecked} connected=${result.programsConnected} activeWithMeta=${result.activeMerchantPrograms.length}`,
  );
  return result;
}

// ---------------------------------------------------------------------------
// Cached program registry (used at affiliate-click time for deeplinks)
// ---------------------------------------------------------------------------

const PROGRAM_CACHE_TTL_MS = 30 * 60 * 1000;
let programCache: { at: number; programs: AdmitadMerchantProgram[] } | null = null;

/** All known active merchant programs (cached 30 min). Empty when discovery is unavailable. */
export async function getAdmitadPrograms(): Promise<AdmitadMerchantProgram[]> {
  if (programCache && Date.now() - programCache.at < PROGRAM_CACHE_TTL_MS) {
    return programCache.programs;
  }
  try {
    const discovery = await discoverAdmitadMerchants();
    programCache = { at: Date.now(), programs: discovery.activeMerchantPrograms };
    return programCache.programs;
  } catch (err) {
    console.error(
      "[admitad-discovery] program lookup failed:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Find the merchant program a destination URL belongs to.
 * Matches the program's site_url hostname against the destination.
 */
export function findAdmitadProgramForDestination(
  destinationUrl: string,
  programs: AdmitadMerchantProgram[],
): AdmitadMerchantProgram | null {
  const destHost = hostnameOf(destinationUrl);
  if (!destHost) return null;

  for (const program of programs) {
    const siteHost = hostnameOf(program.siteUrl);
    if (!siteHost) continue;
    if (destHost === siteHost || destHost.endsWith(`.${siteHost}`)) {
      return program;
    }
  }

  // Fall back to a relaxed match: destination host starts with the first
  // label of the program name (e.g. "sunsky-online.com" ↔ "Sunsky-online WW").
  const destFirst = destHost.split(".")[0];
  if (destFirst && destFirst.length > 3) {
    for (const program of programs) {
      const normalized = program.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (normalized.startsWith(destFirst.replace(/[^a-z0-9]/g, ""))) {
        return program;
      }
    }
  }

  return null;
}

/**
 * Generate a REAL Admitad deeplink for a destination using the discovered
 * program's campaign ID + website ID. Returns null when no program matches,
 * the program does not support deeplinks, or the API call fails.
 */
export async function generateAdmitadDeeplinkForDestination(
  destinationUrl: string,
): Promise<string | null> {
  const programs = await getAdmitadPrograms();
  if (programs.length === 0) return null;

  const program = findAdmitadProgramForDestination(destinationUrl, programs);
  if (!program || !program.canGenerateDeeplinks) return null;

  try {
    const resp = await generateDeeplink(program.websiteId, program.campaignId, destinationUrl);
    const link = (resp as { link?: string }).link;
    if (link && link.startsWith("http")) return link;
    return null;
  } catch (err) {
    console.error(
      "[admitad-deeplink] generation failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
