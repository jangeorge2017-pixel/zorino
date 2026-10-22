/**
 * ArabClicks universal product-feed runner.
 *
 * Wraps `syncArabClicksFeed()` (CSV/XML auto-detecting feed importer) with
 * deployment-safe defaults and Search visibility:
 *
 *   ARABCLICKS_FEED_URL                 — required real feed URL
 *   ARABCLICKS_FEED_SYNC_ENABLED        — master switch (default OFF)
 *   ARABCLICKS_FEED_DRY_RUN             — parse/map only, no DB writes (default ON)
 *   ARABCLICKS_FEED_MAX_ITEMS           — rows per run (default 1000)
 *   ARABCLICKS_FEED_BATCH_SIZE          — rows buffered per write batch (default 100)
 *   ARABCLICKS_FEED_WRITE_CONCURRENCY   — concurrent PostgREST chains (default 6)
 *   ARABCLICKS_FEED_FETCH_TIMEOUT_MS    — whole-response fetch timeout (default 300s)
 *   ARABCLICKS_FEED_DEFAULT_COUNTRY     — single-market feed fallback (e.g. EG)
 *   ARABCLICKS_FEED_DEFAULT_CURRENCY    — single-currency feed fallback (e.g. EGP)
 *
 * Safety: with the master switch off (or the URL unset) this returns an
 * explicit skip reason and never touches the network. `dryRun` (the default)
 * parses and maps every row without writing to Supabase. Only a run with
 * `enabled && !dryRun` writes products/offers and then bridges the touched
 * offers into `lowest_prices_today` so Search can see them.
 */

import type { SupabaseDb } from "@/lib/supabase/config";
import {
  syncArabClicksFeed,
  type ArabClicksSyncResult,
} from "@/lib/sync/import/arabclicks-catalog";
import {
  bridgeArabClicksOffersToLowestPrices,
  type ArabClicksBridgeResult,
} from "@/lib/sync/import/arabclicks-bridge";

export const ARABCLICKS_FEED_ENV = {
  FEED_URL: "ARABCLICKS_FEED_URL",
  ENABLED: "ARABCLICKS_FEED_SYNC_ENABLED",
  DRY_RUN: "ARABCLICKS_FEED_DRY_RUN",
  MAX_ITEMS: "ARABCLICKS_FEED_MAX_ITEMS",
  BATCH_SIZE: "ARABCLICKS_FEED_BATCH_SIZE",
  WRITE_CONCURRENCY: "ARABCLICKS_FEED_WRITE_CONCURRENCY",
  FETCH_TIMEOUT_MS: "ARABCLICKS_FEED_FETCH_TIMEOUT_MS",
  DEFAULT_COUNTRY: "ARABCLICKS_FEED_DEFAULT_COUNTRY",
  DEFAULT_CURRENCY: "ARABCLICKS_FEED_DEFAULT_CURRENCY",
} as const;

export type ArabClicksFeedConfig = {
  configured: boolean;
  enabled: boolean;
  dryRun: boolean;
  maxItems: number;
  batchSize: number;
  writeConcurrency: number;
  fetchTimeoutMs: number;
  defaultCountryCode?: string;
  defaultCurrency?: string;
};

function envValue(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = envValue(key)?.toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function envInt(key: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(envValue(key) ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getArabClicksFeedConfig(): ArabClicksFeedConfig {
  const feedUrl = envValue(ARABCLICKS_FEED_ENV.FEED_URL);
  return {
    configured: Boolean(feedUrl),
    enabled: envBool(ARABCLICKS_FEED_ENV.ENABLED, false),
    dryRun: envBool(ARABCLICKS_FEED_ENV.DRY_RUN, true),
    maxItems: envInt(ARABCLICKS_FEED_ENV.MAX_ITEMS, 1_000, 1, 200_000),
    batchSize: envInt(ARABCLICKS_FEED_ENV.BATCH_SIZE, 100, 1, 1_000),
    writeConcurrency: envInt(ARABCLICKS_FEED_ENV.WRITE_CONCURRENCY, 6, 1, 24),
    fetchTimeoutMs: envInt(ARABCLICKS_FEED_ENV.FETCH_TIMEOUT_MS, 300_000, 5_000, 600_000),
    defaultCountryCode: envValue(ARABCLICKS_FEED_ENV.DEFAULT_COUNTRY) ?? undefined,
    defaultCurrency: envValue(ARABCLICKS_FEED_ENV.DEFAULT_CURRENCY) ?? undefined,
  };
}

export function isArabClicksFeedConfigured(): boolean {
  return Boolean(envValue(ARABCLICKS_FEED_ENV.FEED_URL));
}

export function isArabClicksFeedEnabled(): boolean {
  return envBool(ARABCLICKS_FEED_ENV.ENABLED, false);
}

export function isArabClicksFeedDryRun(): boolean {
  return envBool(ARABCLICKS_FEED_ENV.DRY_RUN, true);
}

export type ArabClicksFeedRunResult = {
  skipped?: boolean;
  reason?: string;
  error?: string;
  configured: boolean;
  enabled: boolean;
  dryRun: boolean;
  maxItems: number;
  format?: ArabClicksSyncResult["format"];
  rowsRead?: number;
  productsUpserted?: number;
  offersUpserted?: number;
  skippedRows?: number;
  failed?: number;
  duplicatesSkipped?: number;
  stores?: string[];
  countries?: string[];
  stoppedReason?: ArabClicksSyncResult["stoppedReason"];
  durationMs?: number;
  errors?: string[];
  bridged?: ArabClicksBridgeResult;
};

/** Module-level lock: prevents overlapping feed runs in one instance. */
let feedRunInProgress = false;

/**
 * Run one bounded ArabClicks feed import. Never throws: feed-level failures are
 * reported in `error`, row-level failures in `errors`/`failed`.
 */
export async function runArabClicksFeedIngestion(
  options: {
    /** Absolute epoch ms after which the run stops cleanly. */
    deadlineMs?: number;
    maxItems?: number;
    dryRun?: boolean;
    /** Bypass the ARABCLICKS_FEED_SYNC_ENABLED master switch (manual runs). */
    force?: boolean;
    supabase?: SupabaseDb;
  } = {},
): Promise<ArabClicksFeedRunResult> {
  const config = getArabClicksFeedConfig();
  const dryRun = options.dryRun ?? config.dryRun;
  const maxItems = Math.max(1, Math.min(options.maxItems ?? config.maxItems, 200_000));

  const base: ArabClicksFeedRunResult = {
    configured: config.configured,
    enabled: config.enabled,
    dryRun,
    maxItems,
  };

  if (!config.configured) {
    return { ...base, skipped: true, reason: "feed-url-missing" };
  }
  if (!config.enabled && !options.force) {
    return { ...base, skipped: true, reason: "disabled" };
  }
  if (feedRunInProgress) {
    return { ...base, skipped: true, reason: "already-running" };
  }

  feedRunInProgress = true;
  const startedAt = Date.now();
  try {
    const feedUrl = envValue(ARABCLICKS_FEED_ENV.FEED_URL)!;
    const sync = await syncArabClicksFeed(feedUrl, {
      maxItems,
      dryRun,
      deadlineMs: options.deadlineMs,
      batchSize: config.batchSize,
      writeConcurrency: config.writeConcurrency,
      fetchTimeoutMs: config.fetchTimeoutMs,
      defaultCountryCode: config.defaultCountryCode,
      defaultCurrency: config.defaultCurrency,
      supabase: options.supabase,
    });

    const result: ArabClicksFeedRunResult = {
      ...base,
      format: sync.format,
      rowsRead: sync.rowsRead,
      productsUpserted: sync.productsUpserted,
      offersUpserted: sync.offersUpserted,
      skippedRows: sync.skipped,
      failed: sync.failed,
      duplicatesSkipped: sync.duplicatesSkipped,
      stores: sync.stores,
      countries: sync.countries,
      stoppedReason: sync.stoppedReason,
      durationMs: sync.durationMs,
      errors: sync.errors.slice(0, 10),
    };

    if (!dryRun && sync.offersUpserted > 0) {
      let supabase = options.supabase ?? null;
      if (!supabase) {
        const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
        supabase = createSupabaseServiceClient();
      }
      if (supabase) {
        result.bridged = await bridgeArabClicksOffersToLowestPrices(supabase, {
          // Small clock skew tolerance: offers written during this run.
          since: new Date(startedAt - 2_000),
          maxRows: Math.max(maxItems, 500),
        });
      }
    }

    return result;
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    feedRunInProgress = false;
  }
}
