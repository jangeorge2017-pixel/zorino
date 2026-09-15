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
 * True once a discovery run has produced REAL merchant feeds. These are the
 * "known feeds" served immediately on warm instances while a newer discovery
 * refreshes in the background (see getAllAdmitadFeeds / kickBackgroundRefresh).
 * Only ever set from committed discovery output — never fabricated.
 */
let discoveryHasFeeds = false;

/** Timestamp of the discovery run that produced the current known feeds. */
let lastDiscoveryWithFeedsAt = 0;

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
 * How long the known-feeds result of a completed discovery is served before a
 * lazy background re-discovery is kicked on the next read. The known feeds
 * themselves are only ever replaced by the output of another REAL discovery
 * run — never by a synthetic/stale cache we fabricate for latency.
 */
export const ADMITAD_DISCOVERY_REFRESH_TTL_MS = 30 * 60 * 1000;

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

/** Test-only override for the background refresh TTL (production: 30 min). */
let discoveryRefreshTtlOverrideMs: number | null = null;

export function setAdmitadDiscoveryRefreshTtlForTests(ms: number | null): void {
  discoveryRefreshTtlOverrideMs = ms;
}

/** Reset all discovery state (test seam). */
export function resetAdmitadDiscoveryForTests(): void {
  discoveryFeeds = [];
  discoveryInitialized = false;
  discoveryHasFeeds = false;
  lastDiscoveryWithFeedsAt = 0;
  inFlightDiscovery = null;
  discoveryDeadlineOverrideMs = null;
  discoveryRunnerOverride = null;
  discoveryRefreshTtlOverrideMs = null;
}

function activeDiscoveryDeadlineMs(): number {
  return discoveryDeadlineOverrideMs ?? ADMITAD_DISCOVERY_DEADLINE_MS;
}

function activeDiscoveryRefreshTtlMs(): number {
  return discoveryRefreshTtlOverrideMs ?? ADMITAD_DISCOVERY_REFRESH_TTL_MS;
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
 * Commit a completed discovery result to the known-feeds state. Real-data
 * only: feeds are ALWAYS the output of a genuine discovery run (never
 * synthesized). A run that yielded zero programs does NOT wipe feeds we
 * already hold from a previous real run — a transient empty window must not
 * empty the live catalog; the existing feeds remain known and valid.
 */
function commitDiscoveryResult(merchants: AdmitadMerchantProgram[]): void {
  const configs = merchants
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

  // Real-data only: never wipe known feeds on an empty/failed refresh — a
  // transient empty window must not empty the live catalog. Known feeds are
  // only ever replaced by another REAL discovery result with REAL feeds.
  if (configs.length === 0) {
    console.log(
      "[admitad-config] Discovery returned no usable merchant feeds — keeping last known feeds",
    );
    return;
  }

  discoveryFeeds = configs;
  discoveryHasFeeds = true;
  lastDiscoveryWithFeedsAt = Date.now();

  console.log(
    `[admitad-config] Discovered ${discoveryFeeds.length} merchant programs: ${discoveryFeeds.map(f => f.name).join(', ')}`
  );
}

/**
 * Execute ONE discovery run under the hard wall-clock deadline. Aborts on
 * expiry, swallows errors (mirrors Fix 9: failure → existing empty/fallback
 * state), and marks discovery as attempted so the cold-start contract is
 * preserved — a failed/empty first attempt never retries in a loop.
 */
async function executeDiscoveryRun(): Promise<void> {
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

    commitDiscoveryResult(discovery.activeMerchantPrograms);
  } catch (error) {
    console.error('[admitad-config] Failed to initialize multi-merchant discovery:', error);
  } finally {
    clearTimeout(timer);
    // Mark as attempted even on failure to prevent retry loops (unchanged).
    discoveryInitialized = true;
  }
}

/**
 * The single in-flight discovery run shared by ALL concurrent callers. Fix 9
 * dedup is preserved exactly: at most one run exists at a time and every
 * caller that needs to wait joins the SAME promise. Callers that already hold
 * known feeds never go through here (they bypass via getAllAdmitadFeeds).
 */
function startDiscoveryRun(): Promise<void> {
  if (inFlightDiscovery) return inFlightDiscovery;
  const run = executeDiscoveryRun();
  inFlightDiscovery = run.finally(() => {
    inFlightDiscovery = null;
  });
  return inFlightDiscovery;
}

/**
 * Overlap (Fix 10): when known feeds are already available, a due background
 * refresh is kicked WITHOUT blocking the caller — the request path keeps
 * serving the real known feeds while the new discovery settles out of band.
 * In-flight dedup and the hard deadline still apply to that background run.
 */
function kickBackgroundRefreshIfDue(): void {
  if (inFlightDiscovery) return;
  if (Date.now() - lastDiscoveryWithFeedsAt < activeDiscoveryRefreshTtlMs()) {
    return;
  }
  startDiscoveryRun();
}

/**
 * Initialize multi-merchant discovery. When no usable feeds exist yet this
 * AWAITS the single shared run (safe cold-start behavior preserved). Once a
 * run has been attempted it is a no-op — refreshes flow through the
 * background path in getAllAdmitadFeeds.
 */
export async function initializeMultiMerchantDiscovery(): Promise<void> {
  if (discoveryInitialized) return;
  await startDiscoveryRun();
}

/** Get all registered feeds — discovered merchant programs only. */
export async function getAllAdmitadFeeds(): Promise<AdmitadFeedConfig[]> {
  // Fix 10 overlap: when real known feeds are available serve them IMMEDIATELY
  // (no waiting on any discovery promise) and let a due refresh run in the
  // background. Cold path (no usable feeds yet) preserves the safe behavior:
  // await the single shared discovery run.
  if (discoveryHasFeeds) {
    kickBackgroundRefreshIfDue();
  } else if (!discoveryInitialized) {
    await startDiscoveryRun();
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
