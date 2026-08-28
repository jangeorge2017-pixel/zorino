import StoresPageClient from "@/components/StoresPageClient";
import { getStoresForPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import type { Store } from "@/lib/types/entities";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: StoresPageProps) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Stores",
    description: "Shop from your favorite marketplaces",
    pathname: "/stores",
    locale: locale === "ar" ? "ar" : "en",
  });
}

async function loadStores(): Promise<Store[]> {
  const liveStores = await getStoresForPage();
  if (liveStores.length > 0) {
    // The store directory is intentionally market-agnostic: it shows the full
    // set of active stores so no store is hidden behind a country/region gate.
    // Affiliate/marketplace selection for a specific country happens deeper in
    // the pipeline (store pages / checkout), not at the directory level.
    return liveStores;
  }
  return [
    {
      id: "aliexpress",
      name: "AliExpress",
      slug: "aliexpress",
      website: "https://www.aliexpress.com",
      integrationType: "aliexpress",
      commissionRate: 5,
      supportedRegions: ["US", "GB", "DE", "FR", "ES", "IT", "AE", "SA", "EG"],
      supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR", "EGP"],
      isActive: true,
      logoInitial: "AE",
    },
  ];
}

export default async function StoresPage() {
  const stores = await loadStores();

  return <StoresPageClient stores={stores} />;
}
