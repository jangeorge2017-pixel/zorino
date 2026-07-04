import { SyncLiveProvider } from "@/lib/data-layer/providers/live/sync-live-provider";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { createEbayProvider } from "@/lib/sync/providers/ebay";

class EbayLiveProvider extends SyncLiveProvider {
  readonly providerId = "ebay" as const;

  constructor() {
    super(createEbayProvider(), isEbayConfigured);
  }
}

export const ebayProvider = new EbayLiveProvider();
export default ebayProvider;
