import type { AdmitadFeedConfig } from "./types";
import type { AdmitadMerchantProgram } from "./merchant-discovery";

/**
 * Registered Admitad product feeds.
 *
 * Multi-merchant support: ALL live feeds come programmatically from active
 * merchant programs discovered via the Admitad Publisher API
 * (ADMITAD_DISCOVER_MERCHANTS, default true).
 *
 * The static ADMITAD_FEED_URL feed was RETIRED from the live pipeline: it
 * serves a stale hand-seeded product list, not real program data. Real
 * Alibaba products arrive through the discovered "Alibaba"/"Alibaba WW"
 * campaigns. ADMITAD_FEEDS below is kept only as a legacy constant for the
 * exclusion checks and backwards-compatible exports.
 */
const feedUrl = process.env.ADMITAD_FEED_URL?.trim() || "";
const enableMultiMerchantDiscovery = process.env.ADMITAD_DISCOVER_MERCHANTS !== "false";

let discoveryFeeds: AdmitadFeedConfig[] = [];
let discoveryInitialized = false;

/**
 * Hard wall-clock budget for one merchant-discovery run. Mirrors the search
 * engine's per-provider budget (`PROVIDER_FETCH_TIMEOUT_MS` in
 * lib/search/engine.ts) so a slow or rate-limited Admitad Publisher API run
 * can never hold the provider fan-out — and therefore search/homepage — past
 * the engine deadline. On expiry the run is aborted and discovery degrades to
 * the existing empty/fallback state.
 */
export const ADMITAD_DISCOVERY_DEADLINE_MS = 8_000;

/**
 * The single in-flight discovery run shared by ALL concurrent callers.
 *
 * Cold-start bursts (e.g. the homepage catalog fans 8 curated queries out in
 * parallel, each hitting `getAllAdmitadFeeds()` → `isAvailable()` and then
 * `search()`) previously each started their own OAuth + websites + campaigns
 * waterfall because `discoveryInitialized` is only set once a run finishes.
 * Now every caller within the in-flight window awaits this exact promise, so
 * exactly ONE discovery run executes.
 */
let inFlightDiscovery: Promise<void> | null = null;

/** Whether the Admitad Publisher API credentials required for discovery are set. */
export function admitadCredentialsConfigured(): boolean {
  return Boolean(
    process.env.ADMITAD_CLIENT_ID?.trim() &&
      process.env.ADMITAD_CLIENT_SECRET?.trim(),
  );
}

/** Test-only override for the discovery deadline (keeps production at 8s). */
let discoveryDeadlineOverrideMs: number | null = null;

/** Test-only discovery runner override (deterministic, no network). */
let discoveryRunnerOverride:
  | ((
      options: {
        maxFeeds?: number;
        maxProductsPerFeed?: number;
      },
      signal?: AbortSignal,
    ) => Promise<{ activeMerchantPrograms: AdmitadMerchantProgram[] }>)
  | null = null;

export function setAdmitadDiscoveryRunnerForTests(
  runner:
    | ((
        options: {
          maxFeeds?: number;
          maxProductsPerFeed?: number;
        },
        signal?: AbortSignal,
      ) => Promise<{ activeMerchantPrograms: AdmitadMerchantProgram[] }>)
    | null,
): void {
  discoveryRunnerOverride = runner;
}

export function setAdmitadDiscoveryDeadlineForTests(ms: number | null): void {
  discoveryDeadlineOverrideMs = ms;
}

/** Reset all discovery state (test seam). */
export function resetAdmitadDiscoveryForTests(): void {
  discoveryFeeds = [];
  discoveryInitialized = false;
  inFlightDiscovery = null;
  discoveryDeadlineOverrideMs = null;
  discoveryRunnerOverride = null;
}

function activeDiscoveryDeadlineMs(): number {
  return discoveryDeadlineOverrideMs ?? ADMITAD_DISCOVERY_DEADLINE_MS;
}

/** Reject as soon as `signal` aborts — belt-and-suspenders hard deadline. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const onAbort = () =>
      reject(new DOMException("Admitad discovery aborted", "AbortError"));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Initialize multi-merchant discovery by running in a separate process.
 * Concurrent callers share ONE in-flight run (see `inFlightDiscovery`).
 */
export async function initializeMultiMerchantDiscovery(): Promise<void> {
  if (discoveryInitialized) return;

  // Share the single in-flight run with every concurrent caller.
  if (inFlightDiscovery) return inFlightDiscovery;

  inFlightDiscovery = runMultiMerchantDiscovery();
  try {
    await inFlightDiscovery;
  } finally {
    inFlightDiscovery = null;
  }
}

async function runMultiMerchantDiscovery(): Promise<void> {
  // Without Publisher API credentials discovery can never authenticate —
  // obtainAccessToken() throws before any network call. Short-circuit quietly
  // so the common local/unconfigured case produces no error noise. Behavior is
  // identical to the old catch path: discoveryFeeds stays empty and
  // isAvailable() → getActiveProviderAdapters() → false.
  if (!admitadCredentialsConfigured()) {
    discoveryInitialized = true;
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    activeDiscoveryDeadlineMs(),
  );

  try {
    console.log('[admitad-config] Initializing multi-merchant discovery...');

    // Import here to avoid circular dependencies
    const runner =
      discoveryRunnerOverride ??
      (await import('./merchant-discovery')).discoverAdmitadMerchants;

    const discovery = await Promise.race([
      runner(
        {
          maxFeeds: parseInt(process.env.ADMITAD_MAX_FEEDS || '20'),
          maxProductsPerFeed: parseInt(process.env.ADMITAD_MAX_PRODUCTS_PER_FEED || '5000'),
        },
        controller.signal,
      ),
      rejectOnAbort(controller.signal),
    ]);

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
  } catch (error) {
    console.error('[admitad-config] Failed to initialize multi-merchant discovery:', error);
  } finally {
    clearTimeout(timer);
    // Mark as initialized even on failure to prevent retry loops (unchanged).
    discoveryInitialized = true;
  }
}

/** Get all registered feeds — discovered merchant programs only. */
export async function getAllAdmitadFeeds(): Promise<AdmitadFeedConfig[]> {
  // Initialize discovery on first call
  if (!discoveryInitialized) {
    await initializeMultiMerchantDiscovery();
  }

  // Deduplicate by slug AND by feed URL.
  const seenSlugs = new Set<string>();
  const seenUrls = new Set<string>();
  const unique = discoveryFeeds.filter((feed) => {
    if (seenSlugs.has(feed.slug) || seenUrls.has(feed.feedUrl)) return false;
    seenSlugs.add(feed.slug);
    seenUrls.add(feed.feedUrl);
    return true;
  });

  // Process Alibaba / "Alibaba WW" merchant programs FIRST. The live feed
  // fetcher runs within a wall-clock deadline, so without this Alibaba could be
  // skipped while other Admitad merchants consume the budget. Stable sort moves
  // every Alibaba feed to the front while preserving all other merchants (and
  // the relative order of remaining feeds) untouched.
  const isAlibaba = (name: string) => /alibaba/i.test(name);
  return unique.sort(
    (a, b) => Number(isAlibaba(b.name)) - Number(isAlibaba(a.name)),
  );
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
