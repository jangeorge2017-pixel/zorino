import { notFound } from "next/navigation";
import ProductDetailsPageClient from "@/components/ProductDetailsPageClient";
import ProductOutboundRedirect from "@/components/ProductOutboundRedirect";
import { ProductJsonLd } from "@/components/ProductJsonLd";
import {
  parseMarketplaceProductId,
  resolveMarketplaceProductDetail,
  resolveMarketplaceRedirectUrl,
} from "@/lib/data/marketplace-product-detail";
import { generateProductMetadata } from "@/lib/seo/metadata";

type ProductPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { id, locale } = await params;
  const detail = await resolveMarketplaceProductDetail(id);
  if (!detail) {
    const redirectUrl = await resolveMarketplaceRedirectUrl(id);
    if (redirectUrl) {
      const { providerId } = parseMarketplaceProductId(id);
      const storeName = providerId === "amazon-eg" ? "Amazon Egypt" : "Amazon";
      return {
        title: `Opening on ${storeName}`,
        description: `This product opens on ${storeName}.`,
      };
    }
    return { title: "Product Not Found" };
  }

  return generateProductMetadata(
    {
      name: detail.product.name,
      description: detail.product.description ?? detail.product.name,
      price: detail.comparison.lowestPrice ?? 0,
      image: detail.product.imageUrl,
      category: detail.categoryName,
      marketplace: detail.comparison.cheapestStoreName ?? "Zorino",
    },
    { locale: locale as "en" | "ar", pathname: `/product/${id}` }
  );
}

export default async function ProductDetailsPage({ params }: ProductPageProps) {
  const { id } = await params;
  const detail = await resolveMarketplaceProductDetail(id);
  if (!detail) {
    // When a marketplace genuinely cannot serve an internal detail page but the
    // product really exists (e.g. Amazon US/EG without API credentials), use its
    // correct existing outbound flow instead of a fabricated page or a dead
    // "Product Not Found". A client component navigates through the existing
    // /api/affiliate/go route (excluded from the i18n proxy) so the user lands
    // on the real product URL with its existing affiliate tag — without
    // next-intl rewriting a server-side redirect into a looping internal path.
    const redirectUrl = await resolveMarketplaceRedirectUrl(id);
    if (redirectUrl) {
      const { providerId } = parseMarketplaceProductId(id);
      const href = `/api/affiliate/go?store=${encodeURIComponent(
        providerId === "amazon-eg" ? "amazon-eg" : "amazon",
      )}&to=${encodeURIComponent(redirectUrl)}&source=product-detail`;
      return <ProductOutboundRedirect href={href} />;
    }
    notFound();
  }
  return (
    <>
      <ProductJsonLd detail={detail} />
      <ProductDetailsPageClient detail={detail} />
    </>
  );
}
