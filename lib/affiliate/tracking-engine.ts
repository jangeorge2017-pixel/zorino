/**
 * Dynamic affiliate tracking-param engine.
 *
 * One place decides WHICH query parameter carries WHICH tracking value for a
 * network, so new stores never need a bespoke switch in the URL builder.
 *
 * Rules:
 *  - Never invent a tracking value. A token comes only from a configured env
 *    var (or the explicit `ZORINO_TRACKING_TOKEN` / `zorino-20` default for
 *    networks that accept free-form sub-ids).
 *  - Never overwrite a tracking param the network/feed already set
 *    (`subid`, `ARABCLICKS_TRACKING_PARAM`) — that would reassign attribution.
 *  - Pass-through networks (AliExpress portal links, Noon short links,
 *    CJdropshipping) are never re-tagged here.
 */

import type { AffiliateMarketplace } from "@/lib/affiliate/config";

/** Networks this engine understands (superset of affiliate marketplaces). */
export type TrackingNetwork = AffiliateMarketplace;

export const DEFAULT_TRACKING_TOKEN = "zorino-20";
export const TRACKING_TOKEN_ENV_KEY = "ZORINO_TRACKING_TOKEN";

/**
 * Token env chain per network (first non-empty wins). `ZORINO_TRACKING_TOKEN`
 * and then `DEFAULT_TRACKING_TOKEN` are appended by `resolveTrackingToken()`.
 */
const NETWORK_TOKEN_ENV_KEYS: Record<TrackingNetwork, readonly string[]> = {
  amazon: [],
  "amazon-eg": [],
  aliexpress: ["ALIEXPRESS_TRACKING_ID"],
  ebay: [],
  walmart: [],
  temu: [],
  noon: [],
  admitad: ["ADMITAD_SUBID"],
  arabclicks: ["ARABCLICKS_SUBID"],
};

/** Networks whose sub-id is free-form, so the shared default token is valid. */
const DEFAULT_TOKEN_NETWORKS: ReadonlySet<TrackingNetwork> = new Set([
  "admitad",
  "arabclicks",
]);

/** Networks whose links arrive already tracked and must never be re-tagged. */
export const PASS_THROUGH_TRACKING_NETWORKS: ReadonlySet<TrackingNetwork> = new Set([
  "aliexpress",
  "noon",
]);

function isTruthyEnv(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/** Kill switch for app-side tracking enrichment (`AFFILIATE_TRACKING_DISABLED`). */
export function isTrackingEnabled(): boolean {
  return !isTruthyEnv(process.env.AFFILIATE_TRACKING_DISABLED);
}

/**
 * Token for a network: network-specific env first, then the shared
 * `ZORINO_TRACKING_TOKEN`, then `zorino-20` for sub-id networks. `null` means
 * "no tracking configured" and the URL is left untouched.
 */
export function resolveTrackingToken(
  network: TrackingNetwork,
  override?: string | null,
): string | null {
  const explicit = override?.trim();
  if (explicit) return explicit;

  for (const key of NETWORK_TOKEN_ENV_KEYS[network] ?? []) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  const shared = process.env[TRACKING_TOKEN_ENV_KEY]?.trim();
  if (shared) return shared;

  return DEFAULT_TOKEN_NETWORKS.has(network) ? DEFAULT_TRACKING_TOKEN : null;
}

/**
 * Query parameter that receives the tracking token for networks whose param
 * name is deployment-specific. ArabClicks issues per-publisher links, so the
 * param is only applied when `ARABCLICKS_TRACKING_PARAM` names it.
 */
export function getArabClicksTrackingParam(): string | null {
  const param = process.env.ARABCLICKS_TRACKING_PARAM?.trim();
  return param ? param : null;
}

function setIfAbsent(url: URL, param: string, value: string): void {
  if (url.searchParams.has(param)) return;
  url.searchParams.set(param, value);
}

export type ApplyTrackingOptions = {
  /** Partner/campaign tag (Amazon tag, eBay campaign id, …). */
  tag?: string | null;
  /** Explicit token override (falls back to `resolveTrackingToken`). */
  token?: string | null;
};

/**
 * Apply the network's tracking parameters in place and return the same URL.
 * Unknown networks are left untouched.
 */
export function applyTrackingParams(
  url: URL,
  network: TrackingNetwork,
  options: ApplyTrackingOptions = {},
): URL {
  if (!isTrackingEnabled()) return url;
  if (PASS_THROUGH_TRACKING_NETWORKS.has(network)) return url;

  const tag = options.tag?.trim() || null;
  const token = resolveTrackingToken(network, options.token);

  switch (network) {
    case "amazon":
    case "amazon-eg":
      if (tag) url.searchParams.set("tag", tag);
      break;
    case "ebay":
      if (tag) url.searchParams.set("campid", tag);
      if (token) url.searchParams.set("customid", token);
      break;
    case "walmart":
      if (tag) url.searchParams.set("wmlspartner", tag);
      if (token) url.searchParams.set("sourceid", token.slice(0, 16));
      break;
    case "temu":
      if (tag) url.searchParams.set("ref", tag);
      if (token) url.searchParams.set("_p_rfs", token.slice(0, 12));
      break;
    case "admitad":
      // Admitad deep links are already tracked; only a sub-id marker is added.
      if (token) setIfAbsent(url, "subid", token);
      break;
    case "arabclicks": {
      const param = getArabClicksTrackingParam();
      if (param && token) setIfAbsent(url, param, token);
      break;
    }
    default:
      break;
  }

  return url;
}

/** URL-string convenience wrapper: never throws, returns the input on failure. */
export function applyTrackingToUrl(
  destinationUrl: string,
  network: TrackingNetwork,
  options: ApplyTrackingOptions = {},
): string {
  try {
    const url = new URL(destinationUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return destinationUrl;
    return applyTrackingParams(url, network, options).toString();
  } catch {
    return destinationUrl;
  }
}
