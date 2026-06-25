import AffiliateDashboard from "@/components/admin/AffiliateDashboard";
import AffiliateSettingsForm from "@/components/admin/AffiliateSettingsForm";
import { getAffiliateAnalytics, getAffiliateSettings } from "@/services/affiliate";
import { getProfitAnalytics } from "@/services/affiliate/profit";

export default async function AdminAffiliatePage() {
  const [analytics, settings] = await Promise.all([
    getAffiliateAnalytics(),
    getAffiliateSettings(),
  ]);
  const profit = await getProfitAnalytics(analytics.totalClicks, analytics.clicksLast30Days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Affiliate Analytics</h1>
        <p className="text-gray-400">
          Track outbound clicks, estimated conversions, and commission across marketplaces
        </p>
      </div>

      <AffiliateDashboard analytics={analytics} profit={profit} />
      <AffiliateSettingsForm settings={settings} />
    </div>
  );
}
