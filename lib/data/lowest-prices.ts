import { unstable_cache } from "next/cache";
import { getLowestPricesToday } from "@/services/lowest-prices";
import {
  DEFAULT_LOWEST_COUNTRY,
  DEFAULT_LOWEST_CURRENCY,
  DEFAULT_LOWEST_LIMIT,
  LOWEST_PRICES_REVALIDATE_SECONDS,
  LOWEST_PRICES_TAG,
} from "@/lib/lowest-prices/config";
import type { LowestPriceTodayItem } from "@/lib/types/entities";

async function fetchLowestPricesUncached(
  countryCode: string,
  currency: string
): Promise<LowestPriceTodayItem[]> {
  const { data, error } = await getLowestPricesToday({
    countryCode,
    currency,
    limit: DEFAULT_LOWEST_LIMIT,
  });
  if (error) return [];
  return data;
}

const getCachedLowestPrices = unstable_cache(
  fetchLowestPricesUncached,
  ["homepage-lowest-prices"],
  {
    revalidate: LOWEST_PRICES_REVALIDATE_SECONDS,
    tags: [LOWEST_PRICES_TAG],
  }
);

/** Cached lowest prices for homepage (all sort options share same dataset). */
export async function getHomepageLowestPrices(
  countryCode = DEFAULT_LOWEST_COUNTRY,
  currency = DEFAULT_LOWEST_CURRENCY
): Promise<LowestPriceTodayItem[]> {
  return getCachedLowestPrices(countryCode, currency);
}

export async function getLowestPricesLastComputed(): Promise<string | null> {
  const { getLowestPriceRefreshStatus } = await import("@/services/lowest-prices");
  const { data } = await getLowestPriceRefreshStatus();
  return (data?.last_run_at as string | null) ?? null;
}
