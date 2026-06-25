import AffiliateDashboard from "@/components/admin/AffiliateDashboard";
import AffiliateSettingsForm from "@/components/admin/AffiliateSettingsForm";
import { getAffiliateAnalytics, getAffiliateSettings } from "@/services/affiliate";

export default async function AdminAffiliatePage() {
  const [analytics, settings] = await Promise.all([
    getAffiliateAnalytics(),
    getAffiliateSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Affiliate Analytics</h1>
        <p className="text-gray-400">
          Track outbound clicks across Amazon, AliExpress, eBay, Walmart and Temu
        </p>
      </div>

      <AffiliateDashboard analytics={analytics} />
      <AffiliateSettingsForm settings={settings} />
    </div>
  );
}
