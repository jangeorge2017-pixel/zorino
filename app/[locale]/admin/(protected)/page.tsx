import Link from "next/link";
import { Package, Store, Tag, ShoppingBag } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AdminPriceSyncPanel from "@/components/admin/AdminPriceSyncPanel";
import AdminImportPanel from "@/components/admin/AdminImportPanel";
import AdminLowestPricesPanel from "@/components/admin/AdminLowestPricesPanel";
import AdminTrendingPanel from "@/components/admin/AdminTrendingPanel";
import { getCatalogStats } from "@/services/stats";
import { getLowestPriceRefreshStatus } from "@/services/lowest-prices";
import { getTrendingRefreshStatus } from "@/services/trending";
import { buildImportIntegrationReport } from "@/lib/sync/providers/integration-report";

export default async function AdminOverviewPage() {
  const [{ data: stats }, { data: lowestJob }, { data: trendingJob }, importReport] =
    await Promise.all([
      getCatalogStats(),
      getLowestPriceRefreshStatus(),
      getTrendingRefreshStatus(),
      buildImportIntegrationReport(),
    ]);

  const cards = [
    { label: "Stores", value: stats.stores, icon: Store, href: "/admin/stores" },
    { label: "Products", value: stats.products, icon: Package, href: "/admin/products" },
    { label: "Coupons", value: stats.coupons, icon: Tag, href: "/admin/coupons" },
    { label: "Deals", value: stats.deals, icon: ShoppingBag, href: "/admin/deals" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Manage your Zorino catalog and promotions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between mb-3">
              <card.icon className="w-5 h-5 text-purple-400" />
              <Link href={card.href} className="text-xs text-purple-400 hover:text-purple-300">
                Manage →
              </Link>
            </div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
            <p className="text-gray-400 text-sm mt-1">{card.label}</p>
          </Card>
        ))}
      </div>

      <AdminImportPanel
        providers={importReport.providers.map((p) => ({
          id: p.id,
          name: p.name,
          configured: p.configured,
          mode: p.mode,
          externalProductCount: p.externalProductCount,
          lastSyncAt: p.lastSyncAt,
          missingCredentials: p.missingCredentials,
        }))}
        totals={importReport.totals}
      />

      <AdminPriceSyncPanel
        lastRunAt={lowestJob?.last_run_at ?? null}
        lastStatus={lowestJob?.last_status ?? null}
      />

      <AdminLowestPricesPanel
        lastRunAt={lowestJob?.last_run_at ?? null}
        itemsComputed={lowestJob?.items_computed ?? 0}
        lastStatus={lowestJob?.last_status ?? null}
      />

      <AdminTrendingPanel
        lastRunAt={trendingJob?.last_run_at ?? null}
        itemsRanked={trendingJob?.items_ranked ?? 0}
        lastStatus={trendingJob?.last_status ?? null}
      />

      <Card>
        <h2 className="text-xl font-bold text-white mb-4">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/products"><Button size="sm">Add product</Button></Link>
          <Link href="/admin/stores"><Button size="sm" variant="outline">Add store</Button></Link>
          <Link href="/admin/coupons"><Button size="sm" variant="outline">Add coupon</Button></Link>
          <Link href="/admin/deals"><Button size="sm" variant="outline">Add deal</Button></Link>
        </div>
      </Card>
    </div>
  );
}
