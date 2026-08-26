import { notFound } from "next/navigation";
import StoreDetailPageClient from "@/components/StoreDetailPageClient";
import { searchProducts } from "@/lib/search/engine";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { getStoreBySlug } from "@/services/stores";
import type { MockStoreDetail } from "@/lib/mock/types";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

type StoreDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

const STORE_META: Record<string, { title: string; description: string }> = {
  aliexpress: {
    title: "AliExpress",
    description:
      "Live AliExpress catalog — products, prices, and affiliate links.",
  },
  amazon: {
    title: "Amazon",
    description:
      "Browse Amazon offers and tracked prices on Zorino.",
  },
  "amazon-eg": {
    title: "Amazon Egypt",
    description:
      "Browse Amazon Egypt offers and tracked prices on Zorino.",
  },
  ebay: {
    title: "eBay",
    description:
      "Browse eBay offers and tracked prices on Zorino.",
  },
  noon: {
    title: "Noon",
    description:
      "Browse Noon offers and coupons on Zorino.",
  },
  walmart: {
    title: "Walmart",
    description:
      "Browse Walmart offers on Zorino.",
  },
  "best-buy": {
    title: "Best Buy",
    description:
      "Browse Best Buy offers on Zorino.",
  },
};

export async function generateMetadata({ params }: StoreDetailPageProps) {
  const { slug, locale } = await params;
  const meta = STORE_META[slug];
  if (!meta) {
    return { title: "Store" };
  }
  return buildSeoMetadata({
    ...meta,
    pathname: `/stores/${slug}`,
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { slug } = await params;

  // Real store row — website/logo/commission come from the database.
  const { data: store } = await getStoreBySlug(slug);
  if (!store) {
    notFound();
  }

  const searchProviderId = resolveMarketplaceId(slug);
  const queries = ["iphone", "samsung", "laptop", "monitor", "earbuds", "keyboard", "smartwatch", "camera"];
  const batches = searchProviderId
    ? await Promise.all(
        queries.map((q) => searchProducts(q, 8).catch(() => [])),
      )
    : [];
  const seen = new Set<string>();
  const allResults = batches.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const storeProducts = allResults.filter(
    (item) => resolveMarketplaceId(item.storeSlug) === searchProviderId,
  );

  const detail: MockStoreDetail = {
    store,
    description: `Live ${store.name} offers from the Zorino marketplace engine.`,
    productCount: storeProducts.length,
    avgRating: 0,
    dealsCount: storeProducts.filter((p) => p.discount > 0).length,
    couponsCount: 0,
    products: storeProducts,
  };

  return <StoreDetailPageClient detail={detail} />;
}
