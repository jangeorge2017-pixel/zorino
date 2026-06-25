"use client";

import { useState, useTransition } from "react";
import { Key, Save, CheckCircle2, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { adminSaveIntegrationSettings } from "@/lib/admin/actions";
import type { IntegrationSettingField } from "@/lib/integration/settings";

type IntegrationSettingsFormProps = {
  fields: IntegrationSettingField[];
};

const PROVIDER_GROUPS = [
  { id: "aliexpress", title: "AliExpress API", description: "Open Platform affiliate product API" },
  { id: "ebay", title: "eBay API", description: "Browse API + OAuth client credentials" },
  { id: "cjdropshipping", title: "CJdropshipping API", description: "Product list REST API" },
] as const;

export default function IntegrationSettingsForm({ fields }: IntegrationSettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await adminSaveIntegrationSettings(values);
      if (result.error) setError(result.error);
      else {
        setMessage("Settings saved. Live imports will use these keys on the next sync.");
        setValues({});
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <Key className="w-5 h-5 text-purple-400 mt-0.5" />
          <div>
            <h2 className="text-xl font-bold text-white">Marketplace API Keys</h2>
            <p className="text-sm text-gray-400 mt-1">
              Add keys here to switch from demo/cached products to live marketplace imports.
              Environment variables on Vercel take precedence when set.
            </p>
          </div>
        </div>

        {message && <p className="text-sm text-green-400 mb-4">{message}</p>}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="space-y-8">
          {PROVIDER_GROUPS.map((group) => {
            const groupFields = fields.filter((f) => f.provider === group.id);
            const configured = groupFields.some((f) => f.configured);
            return (
              <div key={group.id} className="border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{group.title}</h3>
                    <p className="text-xs text-gray-500">{group.description}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      configured
                        ? "bg-green-500/20 text-green-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {configured ? (
                      <>
                        <CheckCircle2 size={12} /> Live ready
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} /> Demo mode
                      </>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm text-gray-300 mb-1">{field.label}</label>
                      <Input
                        type={field.isSecret ? "password" : "text"}
                        placeholder={
                          field.configured
                            ? field.hasEnvValue
                              ? "Set via environment"
                              : "•••••••• (saved)"
                            : `Enter ${field.label}`
                        }
                        value={values[field.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                      <p className="text-xs text-gray-600 mt-1 font-mono">{field.key}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={handleSave} disabled={pending} className="inline-flex gap-2">
            <Save size={16} />
            {pending ? "Saving…" : "Save API keys"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
