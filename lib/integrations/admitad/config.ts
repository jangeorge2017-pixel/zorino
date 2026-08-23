import type { AdmitadFeedConfig } from "./types";

/**
 * Registered Admitad product feeds.
 *
 * Multi-merchant support:
 * 1. Primary feed from ADMITAD_FEED_URL (Alibaba by default)
 * 2. Programmatically discovered feeds from active merchant programs
 * 3. All feeds validated for accessibility before use
 *
 * The system first tries the environment variable, then discovers active programs
 * via the Admitad Publisher API, then validates each feed.
 *
 * Set ADMITAD_FEED_URL in Vercel Production Environment Variables for the primary feed.
 * Enable multi-merchant discovery via ADMITAD_DISCOVER_MERCHANTS (default: true).
 */
const feedUrl = process.env.ADMITAD_FEED_URL?.trim() || "";
const enableMultiMerchantDiscovery = process.env.ADMITAD_DISCOVER_MERCHANTS !== "false";

let discoveryFeeds: AdmitadFeedConfig[] = [];
let discoveryInitialized = false;

/** Initialize multi-merchant discovery by running in a separate process. */
export async function initializeMultiMerchantDiscovery(): Promise<void> {
  if (discoveryInitialized) return;
  
  try {
    console.log('[admitad-config] Initializing multi-merchant discovery...');
    
    // Import here to avoid circular dependencies
    const { discoverAdmitadMerchants } = await import('./merchant-discovery');
    const discovery = await discoverAdmitadMerchants({ 
      maxFeeds: parseInt(process.env.ADMITAD_MAX_FEEDS || '20'), 
      maxProductsPerFeed: parseInt(process.env.ADMITAD_MAX_PRODUCTS_PER_FEED || '5000')
    });
    
    if (discovery.activeMerchantPrograms.length > 0) {
      // Transform discovered merchants into feed configs
      discoveryFeeds = discovery.activeMerchantPrograms
        .filter((merchant) => Boolean(merchant.feedUrl))
        .map((merchant) => ({
          name: merchant.merchantName,
          slug: `admitad-${merchant.campaignId}`, // Unique slug per program
          feedUrl: merchant.feedUrl as string,
          isPrimary: merchant.merchantName.toLowerCase() === 'alibaba' && !!feedUrl,
          merchantId: merchant.campaignId,
          websiteId: merchant.websiteId,
          canGenerateDeeplinks: merchant.canGenerateDeeplinks,
          geoRestrictions: merchant.geoRestrictions,
          categories: merchant.categories,
        }));
      
      console.log(
        `[admitad-config] Discovered ${discoveryFeeds.length} merchant programs: ${discoveryFeeds.map(f => f.name).join(', ')}`
      );
    } else {
      console.log('[admitad-config] No merchant programs discovered via API');
    }
    
    discoveryInitialized = true;
  } catch (error) {
    console.error('[admitad-config] Failed to initialize multi-merchant discovery:', error);
    discoveryInitialized = true; // Mark as initialized even on failure to prevent retry loops
  }
}

/** Get all registered feeds including primary and discovered ones. */
export async function getAllAdmitadFeeds(): Promise<AdmitadFeedConfig[]> {
  // Initialize discovery on first call
  if (!discoveryInitialized) {
    await initializeMultiMerchantDiscovery();
  }
  
  const feeds: AdmitadFeedConfig[] = [];
  
  // Add primary feed if configured
  if (feedUrl) {
    feeds.push({
      name: "Alibaba",
      slug: "alibaba-admitad",
      feedUrl,
    });
  }
  
  // Add discovered feeds
  feeds.push(...discoveryFeeds);
  
  // Deduplicate by slug AND by feed URL (primary feed takes precedence)
  const seenSlugs = new Set<string>();
  const seenUrls = new Set<string>();
  const uniqueFeeds = feeds.filter((feed) => {
    if (seenSlugs.has(feed.slug) || seenUrls.has(feed.feedUrl)) return false;
    seenSlugs.add(feed.slug);
    seenUrls.add(feed.feedUrl);
    return true;
  });
  
  return uniqueFeeds;
}

export const ADMITAD_FEEDS = feedUrl
  ? [
      {
        name: "Alibaba",
        slug: "alibaba-admitad",
        feedUrl,
      },
    ]
  : [];

export const ADMITAD_PROVIDER_ID = "admitad" as const;

/** How long parsed feed products stay in memory (ms). */
export const FEED_CACHE_TTL_MS = 30 * 60 * 1000;

export { type AdmitadFeedConfig } from "./types";
