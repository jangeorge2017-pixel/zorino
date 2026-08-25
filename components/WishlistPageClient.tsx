"use client";

import { useTranslations } from "next-intl";
import { Heart, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import ListingProductCard from "@/components/ListingProductCard";
import { PageEmptyState, PageHeader, PageLayout } from "@/components/pages";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import { useWishlist } from "@/lib/wishlist/use-wishlist";
import type { SearchResultItem } from "@/lib/data/homepage";

type WishlistPageClientProps = {
  recommendations?: SearchResultItem[];
};

export default function WishlistPageClient({
  recommendations = [],
}: WishlistPageClientProps) {
  const t = useTranslations("wishlist");
  const tCommon = useTranslations("common");
  const { formatPrice } = useIntlPreferences();
  const { items, ready, remove } = useWishlist();

  if (!ready) {
    return (
      <PageLayout>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
      </PageLayout>
    );
  }

  if (items.length === 0) {
    return (
      <PageLayout>
        <PageEmptyState
          icon={<Heart className="w-10 h-10" />}
          title={t("emptyWishlist")}
          description={t("startAddingProducts")}
          actionLabel={t("browseDeals")}
          onAction={() => {
            window.location.href = "/deals";
          }}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t("title")}
        subtitle={t("itemsCount", { count: items.length })}
      />

      <div className="wishlist-items">
        {items.map((item) => (
          <article key={item.id} className="wishlist-item-card product-card deal-card mb-4">
            <ProductCardMedia
              src={item.imageSrc ?? ""}
              alt={item.name}
              fallback={<span className="deal-emoji">{item.emoji ?? "🛍️"}</span>}
              badges={
                item.discount && item.discount > 0 ? (
                  <span className="deal-discount">-{item.discount}%</span>
                ) : null
              }
            />

            <div className="wishlist-item-body">
              <div className="wishlist-item-top">
                <div className="min-w-0">
                  <h3 className="wishlist-item-title">{item.name}</h3>
                  {item.store ? <p className="wishlist-item-store">{item.store}</p> : null}
                </div>
                <button
                  type="button"
                  className="wishlist-remove-btn"
                  aria-label={t("removeAria", { name: item.name })}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="wishlist-item-pricing">
                <span className="wishlist-item-price">{formatPrice(item.price)}</span>
                {item.originalPrice && item.originalPrice > item.price ? (
                  <span className="wishlist-item-original">
                    {formatPrice(item.originalPrice)}
                  </span>
                ) : null}
              </div>

              <div className="wishlist-item-meta">
                <span>{t("addedOn", { date: new Date(item.addedAt).toLocaleDateString() })}</span>
              </div>

              <ProductCardActions productId={item.id} shopHref={`/product/${item.id}#compare-prices`} />
            </div>
          </article>
        ))}
      </div>

      {recommendations.length > 0 ? (
        <section className="wishlist-recommendations mt-10" aria-labelledby="wishlist-rec-heading">
          <h2 id="wishlist-rec-heading" className="text-2xl font-bold text-white mb-6">
            {tCommon("recommended")}
          </h2>
          <div className="listing-products-grid">
            {recommendations.map((product) => (
              <ListingProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  imageSrc: product.imageSrc,
                  emoji: product.emoji,
                  price: product.price,
                  discount: product.discount,
                  store: product.store,
                  storeSlug: product.storeSlug,
                  inStock: product.inStock,
                  affiliateUrl: product.affiliateUrl,
                  salesCount: product.salesCount,
                }}
                showWishlist={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="sr-only">
        <Link href="/deals">{t("browseDeals")}</Link>
      </p>
    </PageLayout>
  );
}
