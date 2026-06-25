"use client";

import { useState, useTransition } from "react";
import { Download, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { adminRunPhase1Import } from "@/lib/admin/actions";

type ProviderStatus = {
  id: string;
  name: string;
  configured: boolean;
  mode: string;
  externalProductCount: number;
  lastSyncAt: string | null;
  missingCredentials: string[];
};

type AdminImportPanelProps = {
  providers: ProviderStatus[];
  totals: {
    externalProducts: number;
    canonicalProducts: number;
    productImages: number;
  };
};

export default function AdminImportPanel({ providers, totals }: AdminImportPanelProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminRunPhase1Import();
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(
          `Imported from ${result.providersRun ?? 0} providers — fetched ${result.itemsFetched ?? 0}, created ${result.itemsCreated ?? 0}, updated ${result.itemsUpdated ?? 0}.`
        );
      }
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Product Import Pipeline</h2>
            <p className="text-sm text-gray-400">
              Phase 1: AliExpress, eBay, and CJdropshipping — title, description, images, price,
              currency, affiliate link, and stock status.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              DB: {totals.externalProducts} external · {totals.canonicalProducts} products ·{" "}
              {totals.productImages} images
            </p>
            {message && <p className="text-sm text-green-400 mt-2">{message}</p>}
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              onClick={handleImport}
              disabled={pending}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
              {pending ? "Importing…" : "Run Phase 1 import"}
            </Button>
            <a href="/api/admin/import-report" target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="inline-flex items-center gap-2">
                <Download size={16} />
                Integration report
              </Button>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
            >
              <p className="font-semibold text-white">{p.name}</p>
              <p className="text-gray-400 mt-1">
                {p.configured ? "Live API" : "Mock fallback"} · {p.externalProductCount} in DB
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last sync: {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : "never"}
              </p>
              {p.missingCredentials.length > 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  Needs: {p.missingCredentials.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
