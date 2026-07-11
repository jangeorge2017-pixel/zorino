import type { ProductDetail } from "@/lib/data/product-detail";
import { getSiteUrl } from "@/lib/site-url";

/** Server-only Product JSON-LD — does not affect visual layout. */
export function ProductJsonLd({ detail }: { detail: ProductDetail }) {
  const siteUrl = getSiteUrl();
  const offer = detail.comparison.offers.find((o) => o.isLowest) ?? detail.comparison.offers[0];
  const price = detail.comparison.lowestPrice || offer?.price || 0;
  const currency = offer?.currency || detail.product.currency || "USD";

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.product.name,
    description: detail.product.description ?? detail.product.name,
    image: detail.images.length > 0 ? detail.images : [detail.product.imageUrl],
    sku: detail.product.id,
    brand: {
      "@type": "Brand",
      name: detail.product.brand || detail.comparison.cheapestStoreName || "Zorino",
    },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${detail.product.id}`,
      priceCurrency: currency,
      price: price > 0 ? price : undefined,
      availability: detail.product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: detail.comparison.cheapestStoreName || "Zorino",
      },
    },
    aggregateRating:
      typeof detail.product.rating === "number" && detail.product.rating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: detail.product.rating,
            reviewCount: Math.max(1, detail.product.reviewCount || 1),
          }
        : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
