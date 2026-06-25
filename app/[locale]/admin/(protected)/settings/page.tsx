import IntegrationSettingsForm from "@/components/admin/IntegrationSettingsForm";
import { getIntegrationSettingsStatus } from "@/lib/integration/settings";

export default async function AdminSettingsPage() {
  const fields = await getIntegrationSettingsStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">
          Configure marketplace API integrations. Without keys, Zorino uses cached demo products
          through the same import pipeline.
        </p>
      </div>
      <IntegrationSettingsForm fields={fields} />
    </div>
  );
}
