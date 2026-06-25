import Card from "@/components/ui/Card";
import type { AffiliateAnalytics } from "@/services/affiliate";

type AffiliateDashboardProps = {
  analytics: AffiliateAnalytics;
};

export default function AffiliateDashboard({ analytics }: AffiliateDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total clicks" value={analytics.totalClicks} />
        <StatCard label="Last 7 days" value={analytics.clicksLast7Days} />
        <StatCard label="Last 30 days" value={analytics.clicksLast30Days} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Clicks by marketplace</h3>
          <div className="space-y-3">
            {analytics.byMarketplace.map((row) => (
              <div key={row.marketplace} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize">{row.marketplace}</span>
                <span className="text-white font-semibold">{row.clicks}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Clicks by source</h3>
          {analytics.bySource.length === 0 ? (
            <p className="text-gray-500 text-sm">No click data yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.bySource.map((row) => (
                <div key={row.source} className="flex items-center justify-between">
                  <span className="text-gray-300">{row.source}</span>
                  <span className="text-white font-semibold">{row.clicks}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Top products (30 days)</h3>
        {analytics.topProducts.length === 0 ? (
          <p className="text-gray-500 text-sm">No product clicks yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topProducts.map((row) => (
                  <tr key={row.productId} className="border-b border-gray-800/50">
                    <td className="py-3 text-white">{row.productName}</td>
                    <td className="py-3 text-right text-purple-300">{row.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {analytics.dailyClicks.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-white mb-4">Daily clicks (14 days)</h3>
          <div className="flex items-end gap-2 h-32">
            {analytics.dailyClicks.map((day) => {
              const max = Math.max(...analytics.dailyClicks.map((d) => d.clicks), 1);
              const height = Math.max(8, (day.clicks / max) * 100);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-500/60 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${day.clicks} clicks`}
                  />
                  <span className="text-[10px] text-gray-500 rotate-0 truncate w-full text-center">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value.toLocaleString("en-US")}</p>
    </Card>
  );
}
