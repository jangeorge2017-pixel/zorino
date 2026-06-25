"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { adminSaveAffiliateSettings } from "@/lib/admin/actions";
import type { AffiliateSetting } from "@/services/affiliate";

type AffiliateSettingsFormProps = {
  settings: AffiliateSetting[];
};

export default function AffiliateSettingsForm({ settings }: AffiliateSettingsFormProps) {
  const [rows, setRows] = useState(settings);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (
    marketplace: string,
    patch: Partial<Pick<AffiliateSetting, "partnerTag" | "commissionRate" | "isEnabled">>
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.marketplace === marketplace ? { ...row, ...patch } : row))
    );
  };

  const handleSave = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminSaveAffiliateSettings(
        rows.map((row) => ({
          marketplace: row.marketplace,
          partnerTag: row.partnerTag,
          commissionRate: row.commissionRate,
          isEnabled: row.isEnabled,
        }))
      );
      if (result.error) setError(result.error);
      else setMessage("Affiliate settings saved.");
    });
  };

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-1">Affiliate Settings</h2>
      <p className="text-sm text-gray-400 mb-6">
        Partner tags for Amazon, AliExpress, eBay, Walmart and Temu. Env vars override when tag is
        empty.
      </p>

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.marketplace}
            className="grid grid-cols-1 md:grid-cols-[140px_1fr_100px_80px] gap-3 items-end p-4 rounded-xl bg-gray-800/40 border border-gray-700"
          >
            <div>
              <p className="text-white font-medium capitalize">{row.displayName}</p>
              <p className="text-xs text-gray-500">{row.marketplace}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Partner tag / ID</label>
              <Input
                value={row.partnerTag ?? ""}
                onChange={(e) => updateRow(row.marketplace, { partnerTag: e.target.value })}
                placeholder="e.g. zorino-20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Commission %</label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={row.commissionRate}
                onChange={(e) =>
                  updateRow(row.marketplace, { commissionRate: Number(e.target.value) })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
              <input
                type="checkbox"
                checked={row.isEnabled}
                onChange={(e) => updateRow(row.marketplace, { isEnabled: e.target.checked })}
                className="rounded border-gray-600"
              />
              On
            </label>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {message && <p className="text-sm text-green-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Card>
  );
}
