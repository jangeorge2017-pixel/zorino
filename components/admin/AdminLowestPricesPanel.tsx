"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { adminRefreshLowestPrices } from "@/lib/admin/actions";

type AdminLowestPricesPanelProps = {
  lastRunAt?: string | null;
  itemsComputed?: number;
  lastStatus?: string | null;
};

export default function AdminLowestPricesPanel({
  lastRunAt,
  itemsComputed = 0,
  lastStatus,
}: AdminLowestPricesPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminRefreshLowestPrices();
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(`Refreshed ${result.itemsComputed ?? 0} lowest price entries.`);
      }
    });
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Lowest Prices Today</h2>
          <p className="text-sm text-gray-400">
            Recompute cheapest offers across all providers for the homepage cache.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Status: {lastStatus ?? "unknown"}
            {lastRunAt ? ` · Last run ${new Date(lastRunAt).toLocaleString()}` : ""}
            {itemsComputed ? ` · ${itemsComputed} items` : ""}
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
          {pending ? "Refreshing…" : "Refresh prices"}
        </Button>
      </div>
    </Card>
  );
}
