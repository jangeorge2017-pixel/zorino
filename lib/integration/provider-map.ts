import type { ProductionProviderId } from "@/lib/integration/constants";
import { PRODUCTION_PROVIDER_IDS } from "@/lib/integration/constants";
import type { DataProviderId } from "@/lib/data-layer/types";

/** Map search/catalog provider ids → data-layer provider ids. */
const PRODUCTION_TO_DATA: Partial<Record<ProductionProviderId, DataProviderId>> = {
  aliexpress: "aliexpress",
  ebay: "ebay",
  amazon: "amazon",
  walmart: "walmart",
  bestbuy: "best-buy",
  noon: "noon",
};

export function productionIdToDataProviderId(
  id: ProductionProviderId
): DataProviderId | null {
  return PRODUCTION_TO_DATA[id] ?? null;
}

/** Production providers that have a data-layer adapter. */
export const DATA_LAYER_PRODUCTION_IDS: DataProviderId[] = PRODUCTION_PROVIDER_IDS.map(
  productionIdToDataProviderId
).filter((id): id is DataProviderId => id !== null);
