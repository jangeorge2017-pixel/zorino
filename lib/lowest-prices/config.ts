import type { LowestPriceSort } from "@/lib/types/entities";

export const LOWEST_PRICES_TAG = "lowest-prices";
export const LOWEST_PRICES_REVALIDATE_SECONDS = 14_400; // 4 hours

export const DEFAULT_LOWEST_COUNTRY = "US";
export const DEFAULT_LOWEST_CURRENCY = "USD";
export const DEFAULT_LOWEST_LIMIT = 12;

export const LOWEST_PRICE_SORT_OPTIONS: { value: LowestPriceSort; label: string }[] = [
  { value: "lowest_price", label: "Lowest Price" },
  { value: "biggest_discount", label: "Biggest Discount" },
  { value: "new_lowest", label: "New Lowest Prices" },
];

export const LOWEST_PRICE_REFRESH_INTERVAL_MINUTES = 240;
