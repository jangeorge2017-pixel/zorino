import { PROVIDER_REGISTRY } from "@/lib/data-layer/config/providers";
import { BaseDataProvider } from "@/lib/data-layer/providers/base";

/** eBay is not used for product listings — AliExpress is the sole live catalog. */
class EbayStubProvider extends BaseDataProvider {
  get meta() {
    return PROVIDER_REGISTRY.ebay;
  }

  isConfigured(): boolean {
    return false;
  }
}

export const ebayProvider = new EbayStubProvider();
export default ebayProvider;
