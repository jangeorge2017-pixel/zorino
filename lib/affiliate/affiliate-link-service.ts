import { aliexpressAffiliateProvider } from "@/lib/affiliate/providers/aliexpress/provider";
import type {
  AffiliateLinkResult,
  AffiliateProviderId,
  GenerateAffiliateLinkInput,
  MarketplaceAffiliateProvider,
} from "@/lib/affiliate/providers/types";

const providers: Record<AffiliateProviderId, MarketplaceAffiliateProvider> = {
  aliexpress: aliexpressAffiliateProvider,
};

/**
 * Centralized Affiliate Link Service (server-side).
 * Routes link generation to marketplace providers.
 * AliExpress uses Affiliate Portal tracking today; Open API can plug in later.
 */
export class AffiliateLinkService {
  getProvider(id: AffiliateProviderId): MarketplaceAffiliateProvider {
    return providers[id];
  }

  listProviders(): MarketplaceAffiliateProvider[] {
    return Object.values(providers);
  }

  async generateLink(
    providerId: AffiliateProviderId,
    input: GenerateAffiliateLinkInput,
  ): Promise<AffiliateLinkResult> {
    return this.getProvider(providerId).generateAffiliateLink(input);
  }

  async generateLinks(
    providerId: AffiliateProviderId,
    inputs: GenerateAffiliateLinkInput[],
  ): Promise<Map<string, AffiliateLinkResult>> {
    const provider = this.getProvider(providerId);
    if (provider.generateAffiliateLinks) {
      return provider.generateAffiliateLinks(inputs);
    }
    const results = new Map<string, AffiliateLinkResult>();
    for (const input of inputs) {
      results.set(input.productUrl, await provider.generateAffiliateLink(input));
    }
    return results;
  }

  /** AliExpress convenience — primary path for portal affiliate operation. */
  async generateAliExpressLink(
    input: GenerateAffiliateLinkInput,
  ): Promise<AffiliateLinkResult> {
    return this.generateLink("aliexpress", input);
  }

  async generateAliExpressLinks(
    inputs: GenerateAffiliateLinkInput[],
  ): Promise<Map<string, AffiliateLinkResult>> {
    return this.generateLinks("aliexpress", inputs);
  }
}

export const affiliateLinkService = new AffiliateLinkService();
