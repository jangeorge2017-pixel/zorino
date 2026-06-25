import MarketplaceSettingsPanel from "@/components/admin/MarketplaceSettingsPanel";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getAliExpressStatus } from "@/services/aliexpress/credentials";
import { getAliExpressSyncSummary } from "@/services/aliexpress/monitoring";

export default async function AdminMarketplacesPage() {
  await hydrateIntegrationCredentials();
  const status = getAliExpressStatus();
  const { runs, logs } = await getAliExpressSyncSummary(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Marketplace Settings</h1>
        <p className="text-gray-400">
          Configure AliExpress affiliate API credentials, validate keys, and monitor import jobs.
        </p>
      </div>
      <MarketplaceSettingsPanel
        status={status}
        logs={logs}
        recentRuns={(runs ?? []) as Parameters<typeof MarketplaceSettingsPanel>[0]["recentRuns"]}
      />
    </div>
  );
}
