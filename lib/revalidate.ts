import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { TRENDING_TAG } from "@/lib/trending/config";

export const CATALOG_TAG = "catalog";
export const LOWEST_PRICES_TAG = "lowest-prices";
export { TRENDING_TAG };

const PUBLIC_PATHS = [
  "/",
  "/deals",
  "/coupons",
  "/stores",
  "/search",
  "/categories",
  "/ar",
  "/ar/deals",
  "/ar/coupons",
  "/ar/stores",
  "/ar/search",
  "/ar/categories",
];

const ADMIN_PATHS = [
  "/admin",
  "/admin/products",
  "/admin/stores",
  "/admin/coupons",
  "/admin/deals",
];

/** Revalidate lowest prices from a Server Action (admin manual refresh). */
export function revalidateLowestPrices() {
  updateTag(LOWEST_PRICES_TAG);
  revalidatePath("/");
  revalidatePath("/ar");
}

/** Invalidate lowest prices cache from Route Handlers / cron jobs. */
export function invalidateLowestPricesFromRoute() {
  revalidateTag(LOWEST_PRICES_TAG, "max");
  revalidatePath("/");
  revalidatePath("/ar");
}

/** Revalidate homepage trending after manual refresh (Server Action). */
export function revalidateTrending() {
  updateTag(TRENDING_TAG);
  revalidatePath("/");
  revalidatePath("/ar");
}

/** Invalidate trending cache from Route Handlers / cron jobs. */
export function invalidateTrendingFromRoute() {
  revalidateTag(TRENDING_TAG, "max");
  revalidatePath("/");
  revalidatePath("/ar");
}

/** Revalidate all public catalog + admin pages after CRUD. */
export function revalidateCatalog() {
  updateTag(CATALOG_TAG);
  for (const path of PUBLIC_PATHS) {
    revalidatePath(path);
  }
  for (const path of ADMIN_PATHS) {
    revalidatePath(path, "layout");
  }
}
