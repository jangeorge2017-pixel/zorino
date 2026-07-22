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
  featuredLabel?: string;
};

function marketplaceBadgeLabel(storeSlug?: string, store?: string): string | null {
  const slug = storeSlug?.trim().toLowerCase();
  if (slug === "aliexpress") return "AliExpress";
  if (slug === "ebay") return "eBay";
  if (slug === "amazon") return "Amazon";
  if (slug === "walmart") return "Walmart";
  if (slug === "temu") return "Temu";
  if (slug === "noon") return "Noon";
  if (slug === "jumia") return "Jumia";
  if (slug === "best-buy" || slug === "bestbuy") return "Best Buy";
  if (slug === "nike") return "Nike";
  if (slug === "apple") return "Apple";
  if (slug === "foot-locker" || slug === "footlocker") return "Foot Locker";
  return store?.trim() || null;
}

export default function ListingProductCard({
  product,
  showWishlist = true,
  featuredLabel,
}: ListingProductCardProps) {
  const tCommon = useTranslations("common");
  const tProduct = useTranslations("product");

  const discount =
    product.discount ??
    (product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  const salesLabel = product.salesCount ?? product.reviewCount;
  const marketplace = marketplaceBadgeLabel(product.storeSlug, product.store);
  const shopHref = product.affiliateUrl
    ? buildAffiliateRedirectPath({
        productId: product.id,
        storeSlug: product.storeSlug || "unknown",
        destinationUrl: product.affiliateUrl,
        source: "search",
      })
    : undefined;

  const leftBadges =
    marketplace || discount > 0 ? (
      <>
        {marketplace ? (
          <span
            className="deal-marketplace product-card-badge"
            data-marketplace={product.storeSlug || undefined}
          >
            {marketplace}
          </span>
        ) : null}
        {discount > 0 ? (
          <span className="deal-discount product-card-badge">-{discount}%</span>
        ) : null}
      </>
    ) : null;

  const rightBadges = featuredLabel ? (
    <span className="zor-deals-page__featured-badge product-card-badge product-card-badge--featured">
      {featuredLabel}
    </span>
  ) : null;

  return (
    <article className="deal-card product-card listing-product-card">
      <ProductCardMedia
        src={product.imageSrc}
        alt={product.name}
        fallback={undefined}
        badges={leftBadges}
        badgesEnd={rightBadges}
      />

      <div className="product-card-body">
        <h3 className="deal-name">{product.name}</h3>
        {/* Always render store/rating slots so equal-height grids stay uniform */}
        <p
          className={`trending-card-store${
            product.category || product.store ? "" : " is-empty"
          }`}
        >
          {[product.category, product.store].filter(Boolean).join(" • ") || "\u00a0"}
        </p>

        <div
          className={`deal-rating${(product.rating ?? 0) > 0 ? "" : " is-empty"}`}
          aria-hidden={(product.rating ?? 0) > 0 ? undefined : true}
        >
          {(product.rating ?? 0) > 0 ? (
            <>
              <Star size={14} className="star-filled" fill="currentColor" />
              <span className="deal-reviews">
                {product.rating}
                {salesLabel
                  ? ` (${salesLabel.toLocaleString("en-US")}${
                      product.salesCount != null ? ` ${tProduct("sold")}` : ""
                    })`
                  : ""}
              </span>
            </>
          ) : (
            "\u00a0"
          )}
        </div>

        <div className="deal-pricing">
          <span className="deal-price">${product.price.toLocaleString("en-US")}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="deal-original">${product.originalPrice.toLocaleString("en-US")}</span>
          )}
        </div>

        {product.inStock !== undefined ? (
          <p className={`listing-stock ${product.inStock ? "in-stock" : "out-of-stock"}`}>
            {product.inStock ? tCommon("inStock") : tCommon("outOfStock")}
          </p>
        ) : (
          <p className="listing-stock is-empty" aria-hidden>
            {"\u00a0"}
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
