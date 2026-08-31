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
  // The store directory shows only real, data-backed merchants derived from
  // the live system. When none resolve, the directory is empty — we never
  // fabricate a store to make the page look populated.
  return getStoresForPage();
}

export default async function StoresPage() {
  const stores = await loadStores();

  return <StoresPageClient stores={stores} />;
}
