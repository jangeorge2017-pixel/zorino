//=== NOON UAE/KSA AFFILIATE INTEGRATION ===
// DISABLED: no real Noon affiliate API is implemented in this codebase.
//
// The previous version of this provider fabricated products/prices/ratings
// with generated mock data (getMockProductsForStore + Math.random()). That
// synthetic data is NOT allowed to reach Zorino production — a fake product is
// indistinguishable from a real one and would poison the catalog, search, and
// price tracking. This provider therefore returns an EMPTY product set and is
// kept only as a structural placeholder until a real Noon API client exists.
//
// Do NOT re-enable mock/fabricated generation here. If real Noon credentials
// are ever added, implement an actual Noon affiliate API client first.

import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const NOON_CREDENTIAL_KEYS = [
  "NOON_API_KEY",
  "NOON_UAE_AFFILIATE_ID",
  "NOON_KSA_AFFILIATE_ID",
] as const;

/**
 * Noon UAE/KSA Provider — PLACEHOLDER ONLY. Never returns fabricated data.
 * @see https://www.noon.com (UAE & KSA)
 */
export class NoonProvider extends BaseConnector {
  id = "noon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "noon" as ImportProviderId,
    name: "Noon UAE/KSA",
    phase: "live",
    apiDocs: "https://www.noon.com/help/platform",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...NOON_CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...NOON_CREDENTIAL_KEYS]);
  }

  async fetchProducts(_ctx: SyncContext): Promise<ExternalProduct[]> {
    // No real Noon affiliate API implementation exists — a real client must be
    // built before this provider can contribute. Returning [] guarantees that
    // even if NOON_* credentials are configured, no fabricated product can
    // ever enter the pipeline.
    return [];
  }

  async fetchDeals(_ctx: SyncContext): Promise<ExternalDeal[]> {
    return [];
  }

  async fetchPrices(
    _ctx: SyncContext,
    _externalIds: string[]
  ): Promise<
    Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]
  > {
    return [];
  }
}

export function createNoonProvider(): NoonProvider {
  return new NoonProvider();
}

export function getNoonProviderId(): ImportProviderId {
  return "noon" as ImportProviderId;
}