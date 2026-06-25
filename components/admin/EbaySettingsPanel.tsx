"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  ShoppingBag,
  Package,
  DollarSign,
  Image,
  Warehouse,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  adminRunEbaySync,
  adminSaveEbaySettings,
  adminValidateEbayCredentials,
} from "@/lib/admin/actions";
import type { EbayCredentialStatus, ImportEventLog } from "@/lib/integrations/ebay/types";

type EbaySettingsPanelProps = {
  status: EbayCredentialStatus;
  logs: ImportEventLog[];
  recentRuns: Array<{
    id: string;
    job_type: string;
    status: string;
    items_fetched: number;
    items_created: number;
    items_updated: number;
    items_failed: number;
    started_at: string;
    error_message: string | null;
  }>;
};

const FIELD_KEYS = [
  { key: "EBAY_APP_ID", label: "App ID (Client ID)", secret: false, optional: false },
  { key: "EBAY_CERT_ID", label: "Cert ID (Client Secret)", secret: true, optional: false },
  { key: "EBAY_CAMPAIGN_ID", label: "Campaign ID (ePN)", secret: false, optional: false },
  { key: "EBAY_OAUTH_TOKEN", label: "OAuth Token (optional)", secret: true, optional: true },
  { key: "EBAY_REFERENCE_ID", label: "Reference ID (optional)", secret: false, optional: true },
] as const;

export default function EbaySettingsPanel({ status, logs, recentRuns }: EbaySettingsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSave = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminSaveEbaySettings(values);
      if (result.error) setError(result.error);
      else {
        setMessage("eBay credentials saved securely.");
        setValues({});
      }
    });
  };

  const handleValidate = () => {
    setValidation(null);
    startTransition(async () => {
      const result = await adminValidateEbayCredentials();
      setValidation({ ok: result.ok, message: result.message });
    });
  };

  const handleSync = (kind: "products" | "prices" | "stock" | "images" | "full") => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminRunEbaySync(kind);
      if (result.error) setError(result.error);
      else setMessage(`eBay ${kind} sync completed.`);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              eBay Affiliate API
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Browse API with eBay Partner Network affiliate context. Credentials below are
              placeholders until you validate and enable live sync. Production stays idle until
              then.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full shrink-0 ${
              status.configured
                ? "bg-green-500/20 text-green-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {status.configured ? (
              <>
                <CheckCircle2 size={12} /> Ready for live sync
              </>
            ) : (
              <>
                <AlertCircle size={12} /> Awaiting credentials
              </>
            )}
          </span>
        </div>

        {message && <p className="text-sm text-green-400 mb-4">{message}</p>}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {validation && (
          <p className={`text-sm mb-4 ${validation.ok ? "text-green-400" : "text-red-400"}`}>
            {validation.message}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {FIELD_KEYS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-gray-300 mb-1">{field.label}</label>
              <Input
                type={field.secret ? "password" : "text"}
                placeholder={placeholderForField(field.key, status)}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={pending} className="inline-flex gap-2">
            <Save size={16} />
            Save credentials
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleValidate}
            disabled={pending}
            className="inline-flex gap-2"
          >
            <CheckCircle2 size={16} />
            Validate API keys
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Manual synchronization</h3>
        <div className="flex flex-wrap gap-2">
          <SyncButton icon={Package} label="Import products" onClick={() => handleSync("products")} disabled={pending} />
          <SyncButton icon={DollarSign} label="Sync prices" onClick={() => handleSync("prices")} disabled={pending} />
          <SyncButton icon={Warehouse} label="Sync stock" onClick={() => handleSync("stock")} disabled={pending} />
          <SyncButton icon={Image} label="Sync images" onClick={() => handleSync("images")} disabled={pending} />
          <SyncButton icon={RefreshCw} label="Full sync" onClick={() => handleSync("full")} disabled={pending} />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Recent sync runs</h3>
        {recentRuns.length === 0 ? (
          <p className="text-gray-500 text-sm">No eBay sync runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2">Job</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Fetched</th>
                  <th className="text-right py-2">Created</th>
                  <th className="text-right py-2">Updated</th>
                  <th className="text-right py-2">Failed</th>
                  <th className="text-left py-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-white">{run.job_type}</td>
                    <td className="py-2 capitalize">{run.status}</td>
                    <td className="py-2 text-right">{run.items_fetched}</td>
                    <td className="py-2 text-right">{run.items_created}</td>
                    <td className="py-2 text-right">{run.items_updated}</td>
                    <td className="py-2 text-right text-red-300">{run.items_failed}</td>
                    <td className="py-2 text-gray-400 text-xs">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Import event log</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">No import events logged yet.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <li
                key={log.id}
                className={`text-sm p-3 rounded-lg border ${
                  log.level === "error"
                    ? "border-red-500/30 bg-red-500/5 text-red-200"
                    : log.level === "warn"
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
                      : "border-gray-800 bg-gray-900/40 text-gray-300"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{log.jobType}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1">{log.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function placeholderForField(key: string, status: EbayCredentialStatus): string {
  if (key === "EBAY_APP_ID") {
    return status.hasAppId ? "•••••••• (configured)" : "Enter App ID";
  }
  if (key === "EBAY_CERT_ID") {
    return status.hasCertId ? "•••••••• (configured)" : "Enter Cert ID";
  }
  if (key === "EBAY_CAMPAIGN_ID") {
    return status.hasCampaignId ? "•••••••• (configured)" : "Enter Campaign ID";
  }
  if (key === "EBAY_OAUTH_TOKEN") {
    return status.hasOauthToken ? "•••••••• (configured)" : "Optional preset token";
  }
  if (key === "EBAY_REFERENCE_ID") {
    return status.hasReferenceId ? "•••••••• (configured)" : "Optional sub-tracking ID";
  }
  return "Enter value";
}

function SyncButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Package;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Icon size={14} className="mr-1.5" />
      {label}
    </Button>
  );
}
