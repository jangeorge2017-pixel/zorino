import { SyncLiveProvider } from "@/lib/data-layer/providers/live/sync-live-provider";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";

class AliExpressLiveProvider extends SyncLiveProvider {
  readonly providerId = "aliexpress" as const;

  constructor() {
    super(createAliExpressProvider(), isAliExpressConfigured);
  }
}

export const aliexpressProvider = new AliExpressLiveProvider();
export default aliexpressProvider;
