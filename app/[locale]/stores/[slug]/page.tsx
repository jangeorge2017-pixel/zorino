import { notFound } from "next/navigation";
import StoreDetailPageClient from "@/components/StoreDetailPageClient";
import { searchProducts } from "@/lib/search/engine";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import type { MockStoreDetail } from "@/lib/mock/types";
import type { Store } from "@/lib/types/entities";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { getMockStoreDetail } from "@/lib/mock/page-data";

type StoreDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

const STORE_META: Record<string, { title: string; description: string }> = {
  aliexpress: {
    title: "AliExpress",
    description:
      "Live AliExpress Affiliates catalog — products, prices, and affiliate links.",
  },
  amazon: {
    title: "Amazon",
    description:
      "Browse Amazon deals, tracked prices, and verified coupons — updated daily on Zorino.",
  },
  ebay: {
    title: "eBay",
    description:
      "Browse eBay deals, tracked prices, and verified coupons — updated daily on Zorino.",
  },
  noon: {
    title: "Noon",
    description:
      "Browse Noon deals, tracked prices, and verified coupons — updated daily on Zorino.",
  },
  walmart: {
    title: "Walmart",
    description:
      "Browse Walmart deals, tracked prices, and verified coupons — updated daily on Zorino.",
  },
  "best-buy": {
    title: "Best Buy",
    description:
      "Browse Best Buy deals, tracked prices, and verified coupons — updated daily on Zorino.",
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

  const searchProviderId = resolveMarketplaceId(slug);
  const queries = ["iphone", "samsung", "laptop", "monitor", "earbuds", "keyboard", "smartwatch", "camera"];
  const batches = await Promise.all(
    queries.map((q) => searchProducts(q, 8).catch(() => [])),
  );
  const seen = new Set<string>();
  const allResults = batches.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const storeProducts = allResults.filter(
    (item) => resolveMarketplaceId(item.storeSlug) === searchProviderId,
  );

  if (storeProducts.length > 0) {
    const avgRating =
      storeProducts.reduce((sum, p) => sum + p.rating, 0) / storeProducts.length;

    const detail: MockStoreDetail = {
      store: {
        id: `store-${slug}`,
        name: storeProducts[0]?.store ?? slug,
        slug,
        website: `https://www.${slug.replace(/-/g, "")}.com`,
        integrationType: "partner",
        commissionRate: 4,
        supportedRegions: ["US"],
        supportedCurrencies: ["USD"],
        isActive: true,
        logoInitial: slug.slice(0, 2).toUpperCase(),
      },
      description: `Live ${storeProducts[0]?.store ?? slug} products — prices and affiliate links from the Zorino marketplace engine.`,
      productCount: storeProducts.length,
      avgRating: Math.round(avgRating * 10) / 10,
      dealsCount: storeProducts.filter((p) => p.discount > 0).length,
      couponsCount: 0,
      products: storeProducts,
    };

    return <StoreDetailPageClient detail={detail} />;
  }

  const detail = getMockStoreDetail(slug);
  if (!detail) {
    notFound();
  }

  return <StoreDetailPageClient detail={detail} />;
}
