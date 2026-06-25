"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { adminRefreshTrending } from "@/lib/admin/actions";

type AdminTrendingPanelProps = {
  lastRunAt?: string | null;
  itemsRanked?: number;
  lastStatus?: string | null;
};

export default function AdminTrendingPanel({
  lastRunAt,
  itemsRanked = 0,
  lastStatus,
}: AdminTrendingPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminRefreshTrending();
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(`Refreshed ${result.itemsRanked ?? 0} trending rankings.`);
      }
    });
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Trending Products</h2>
          <p className="text-sm text-gray-400">
            Recompute trending rankings across all stores for the homepage section.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Status: {lastStatus ?? "unknown"}
            {lastRunAt ? ` · Last run ${new Date(lastRunAt).toLocaleString()}` : ""}
            {itemsRanked ? ` · ${itemsRanked} items` : ""}
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
          {pending ? "Refreshing…" : "Refresh trending"}
        </Button>
      </div>
    </Card>
  );
}
