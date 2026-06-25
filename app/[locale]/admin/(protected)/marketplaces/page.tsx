import MarketplaceSettingsPanel from "@/components/admin/MarketplaceSettingsPanel";
import EbaySettingsPanel from "@/components/admin/EbaySettingsPanel";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getAliExpressStatus } from "@/services/aliexpress/credentials";
import { getAliExpressSyncSummary } from "@/services/aliexpress/monitoring";
import { getEbayStatus } from "@/services/ebay/credentials";
import { getEbaySyncSummary } from "@/services/ebay/monitoring";

type SyncRunRow = {
  id: string;
  job_type: string;
  status: string;
  items_fetched: number;
  items_created: number;
  items_updated: number;
  items_failed: number;
  started_at: string;
  error_message: string | null;
};

export default async function AdminMarketplacesPage() {
  await hydrateIntegrationCredentials();

  const aliexpressStatus = getAliExpressStatus();
  const ebayStatus = getEbayStatus();
  const { runs: aliexpressRuns, logs: aliexpressLogs } = await getAliExpressSyncSummary(10);
  const { runs: ebayRuns, logs: ebayLogs } = await getEbaySyncSummary(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Marketplace Settings</h1>
        <p className="text-gray-400">
          Configure affiliate API credentials, validate keys, and monitor import jobs for each
          marketplace integration.
        </p>
      </div>

      <MarketplaceSettingsPanel
        status={aliexpressStatus}
        logs={aliexpressLogs}
        recentRuns={(aliexpressRuns ?? []) as SyncRunRow[]}
      />

      <EbaySettingsPanel
        status={ebayStatus}
        logs={ebayLogs}
        recentRuns={(ebayRuns ?? []) as SyncRunRow[]}
      />
    </div>
  );
}
