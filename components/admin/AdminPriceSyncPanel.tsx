"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { adminRefreshPrices } from "@/lib/admin/actions";

type AdminPriceSyncPanelProps = {
  lastRunAt?: string | null;
  lastStatus?: string | null;
};

export default function AdminPriceSyncPanel({ lastRunAt, lastStatus }: AdminPriceSyncPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminRefreshPrices();
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(
          `Synced ${result.storesSynced ?? 0} stores, refreshed ${result.lowestPricesComputed ?? 0} lowest prices.`
        );
      }
    });
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Multi-Store Price Sync</h2>
          <p className="text-sm text-gray-400">
            Refresh prices from Amazon, AliExpress, eBay, Walmart and Temu, then update homepage
            caches.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Status: {lastStatus ?? "unknown"}
            {lastRunAt ? ` · Last run ${new Date(lastRunAt).toLocaleString()}` : ""}
            {" · Auto-refresh every 4 hours"}
          </p>
          {message && <p className="text-sm text-green-400 mt-2">{message}</p>}
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
        <Button
          type="button"
          onClick={handleRefresh}
          disabled={pending}
          className="inline-flex items-center gap-2 shrink-0"
        >
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
          {pending ? "Syncing…" : "Refresh all prices"}
        </Button>
      </div>
    </Card>
  );
}
