import { notFound } from "next/navigation";
import StoreDetailPageClient from "@/components/StoreDetailPageClient";
import { browseAliExpressLive } from "@/services/aliexpress/search";
import type { MockStoreDetail } from "@/lib/mock/types";
import type { Store } from "@/lib/types/entities";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { getMockStoreDetail } from "@/lib/mock/page-data";

type StoreDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

const ALIEXPRESS_STORE: Store = {
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
};

const STORE_META: Record<string, { title: string; description: string }> = {
  aliexpress: {
    title: "AliExpress",
    description:
      "Live AliExpress Affiliates catalog — products, prices, and affiliate links.",
  },
  noon: {
    title: "Noon",
    description:
      "Browse Noon deals, tracked prices, and verified coupons — updated daily on Zorino.",
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

  if (slug === "aliexpress") {
    const products = await browseAliExpressLive(24);
    const avgRating =
      products.length > 0
        ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
        : 0;

    const detail: MockStoreDetail = {
      store: ALIEXPRESS_STORE,
      description:
        "Live AliExpress Affiliates catalog — products, prices, and affiliate links from the AliExpress API.",
      productCount: products.length,
      avgRating: Math.round(avgRating * 10) / 10,
      dealsCount: products.filter((p) => p.discount > 0).length,
      couponsCount: 0,
      products,
    };

    return <StoreDetailPageClient detail={detail} />;
  }

  const detail = getMockStoreDetail(slug);
  if (!detail) {
    notFound();
  }

  return <StoreDetailPageClient detail={detail} />;
}
