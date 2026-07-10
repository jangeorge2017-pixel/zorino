"use client";

import { useTranslations } from "next-intl";
import { Star, Heart } from "lucide-react";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import { buildAffiliateRedirectPath } from "@/lib/affiliate/generate";

export type ListingProductCardData = {
  id: string;
  name: string;
  imageSrc: string;
  emoji?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
  salesCount?: number;
  store?: string;
  storeSlug?: string;
  category?: string;
  inStock?: boolean;
  affiliateUrl?: string;
};

type ListingProductCardProps = {
  product: ListingProductCardData;
  showWishlist?: boolean;
};

export default function ListingProductCard({
  product,
  showWishlist = true,
}: ListingProductCardProps) {
  const tCommon = useTranslations("common");
  const tProduct = useTranslations("product");

  const discount =
    product.discount ??
    (product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  const salesLabel = product.salesCount ?? product.reviewCount;
  const shopHref = product.affiliateUrl
    ? buildAffiliateRedirectPath({
        productId: product.id,
        storeSlug: product.storeSlug || "aliexpress",
        destinationUrl: product.affiliateUrl,
        source: "search",
      })
    : undefined;

  return (
    <article className="deal-card product-card listing-product-card">
      <ProductCardMedia
        src={product.imageSrc}
        alt={product.name}
        fallback={<span className="deal-emoji">{product.emoji ?? "🛍️"}</span>}
        badges={discount > 0 ? <span className="deal-discount">-{discount}%</span> : null}
      />

      <div className="product-card-body">
        <h3 className="deal-name">{product.name}</h3>
        {(product.category || product.store) && (
          <p className="trending-card-store">
            {[product.category, product.store].filter(Boolean).join(" • ")}
          </p>
        )}

        {(product.rating ?? 0) > 0 && (
          <div className="deal-rating">
            <Star size={14} className="star-filled" fill="currentColor" />
            <span className="deal-reviews">
              {product.rating}
              {salesLabel
                ? ` (${salesLabel.toLocaleString("en-US")}${
                    product.salesCount != null ? ` ${tProduct("sold")}` : ""
                  })`
                : ""}
            </span>
          </div>
        )}

        <div className="deal-pricing">
          <span className="deal-price">${product.price.toLocaleString("en-US")}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="deal-original">${product.originalPrice.toLocaleString("en-US")}</span>
          )}
        </div>

        {product.inStock !== undefined && (
          <p className={`listing-stock ${product.inStock ? "in-stock" : "out-of-stock"}`}>
            {product.inStock ? tCommon("inStock") : tCommon("outOfStock")}
          </p>
        )}
      </div>

      <ProductCardActions
        productId={product.id}
        shopHref={shopHref}
        shopExternal={Boolean(product.affiliateUrl)}
      />

      {showWishlist && (
        <div className="listing-secondary-actions">
          <button
            type="button"
            className="listing-icon-btn"
            aria-label={tCommon("addToWishlist")}
          >
            <Heart size={18} />
          </button>
        </div>
      )}
    </article>
  );
}
