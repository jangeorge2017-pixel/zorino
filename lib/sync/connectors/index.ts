import { shouldUseMockCatalog, getConnectorForStore } from "@/lib/sync/config";
import { MockConnector } from "@/lib/sync/connectors/mock";
import { getProviderAdapter, isImportProviderId } from "@/lib/sync/providers";
import { ShopifyConnector } from "@/lib/sync/connectors/shopify";
import type { ConnectorId, PartnerConnector } from "@/lib/sync/types";
import type { StoreIntegrationType } from "@/lib/types/entities";

const mockConnector = new MockConnector();

const legacyConnectors: Record<string, PartnerConnector> = {
  mock: mockConnector,
  shopify: new ShopifyConnector(),
  noon: mockConnector,
  walmart: mockConnector,
  partner: mockConnector,
  custom: mockConnector,
};

export function getConnector(connectorId: ConnectorId | string): PartnerConnector {
  if (shouldUseMockCatalog()) return mockConnector;

  if (isImportProviderId(connectorId)) {
    return getProviderAdapter(connectorId);
  }

  return legacyConnectors[connectorId] ?? mockConnector;
}

export function getConnectorForIntegration(integrationType: StoreIntegrationType): PartnerConnector {
  if (shouldUseMockCatalog()) return mockConnector;

  const id = getConnectorForStore(integrationType);
  if (id === "mock") return mockConnector;

  if (isImportProviderId(integrationType)) {
    return getProviderAdapter(integrationType);
  }

  return getConnector(id);
}
