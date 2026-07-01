import { amazonProvider } from "@/lib/data-layer/providers/amazon";
import { ebayProvider } from "@/lib/data-layer/providers/ebay";
import { aliexpressProvider } from "@/lib/data-layer/providers/aliexpress";
import { walmartProvider } from "@/lib/data-layer/providers/walmart";
import { bestBuyProvider } from "@/lib/data-layer/providers/best-buy";
import { noonProvider } from "@/lib/data-layer/providers/noon";
import { jarirProvider } from "@/lib/data-layer/providers/jarir";
import { extraProvider } from "@/lib/data-layer/providers/extra";
import { btechProvider } from "@/lib/data-layer/providers/btech";
import { rayaProvider } from "@/lib/data-layer/providers/raya";
import type { DataProviderId, IDataProvider } from "@/lib/data-layer/types";
import { dataProviderIds } from "@/lib/data-layer/types";

export {
  amazonProvider,
  ebayProvider,
  aliexpressProvider,
  walmartProvider,
  bestBuyProvider,
  noonProvider,
  jarirProvider,
  extraProvider,
  btechProvider,
  rayaProvider,
};

const ALL_PROVIDERS: Record<DataProviderId, IDataProvider> = {
  amazon: amazonProvider,
  ebay: ebayProvider,
  aliexpress: aliexpressProvider,
  walmart: walmartProvider,
  "best-buy": bestBuyProvider,
  noon: noonProvider,
  jarir: jarirProvider,
  extra: extraProvider,
  btech: btechProvider,
  raya: rayaProvider,
};

export function getDataProvider(id: DataProviderId): IDataProvider {
  return ALL_PROVIDERS[id];
}

export function listDataProviders(): IDataProvider[] {
  return dataProviderIds.map((id) => ALL_PROVIDERS[id]);
}

export function getProviderRegistry(): Record<DataProviderId, IDataProvider> {
  return ALL_PROVIDERS;
}
