import { PROVIDER_REGISTRY } from "@/lib/data-layer/config/providers";
import { BaseDataProvider } from "@/lib/data-layer/providers/base";
import type { DataProviderId, DataProviderMeta } from "@/lib/data-layer/types";

class StubDataProvider extends BaseDataProvider {
  readonly meta: DataProviderMeta;

  constructor(id: DataProviderId) {
    super();
    this.meta = PROVIDER_REGISTRY[id];
  }
}

const providerCache = new Map<DataProviderId, StubDataProvider>();

export function createStubProvider(id: DataProviderId): StubDataProvider {
  const existing = providerCache.get(id);
  if (existing) return existing;

  const provider = new StubDataProvider(id);
  providerCache.set(id, provider);
  return provider;
}

export { StubDataProvider };
