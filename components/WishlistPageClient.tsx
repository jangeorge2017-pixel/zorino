"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProductCardMedia from "@/components/ProductCardMedia";
import AssetImage from "@/components/AssetImage";
import ListingProductCard from "@/components/ListingProductCard";
import ProductCardActions from "@/components/ProductCardActions";
import { PageEmptyState, PageHeader, PageLayout } from "@/components/pages";
import type { MockWishlistItem } from "@/lib/mock/types";
import { MOCK_SEARCH_ITEMS } from "@/lib/mock/sample-data";
import { AlertTriangle, CheckCircle, Heart, Trash2 } from "lucide-react";

type WishlistPageClientProps = {
  items: MockWishlistItem[];
};

export default function WishlistPageClient({ items: initialItems }: WishlistPageClientProps) {
  const t = useTranslations("wishlist");
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((item) => item.id));
    }
  };

  const removeSelected = () => {
    setItems((prev) => prev.filter((item) => !selectedItems.includes(item.id)));
    setSelectedItems([]);
  };

  if (!user) {
    return (
      <PageLayout>
        <PageEmptyState
          icon={<Heart className="w-10 h-10" />}
          title={t("loginRequired")}
          description={t("loginToViewWishlist")}
          actionLabel={t("login")}
          onAction={() => router.push("/auth/login")}
        />
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
          onAction={() => router.push("/deals")}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t("title")}
        subtitle={`${items.length} ${items.length === 1 ? "item" : "items"} in your wishlist`}
      />

      {selectedItems.length > 0 && (
        <Card className="wishlist-selection-bar mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-white font-medium">
              {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"} selected
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push("/compare")}>
                Compare
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                onClick={removeSelected}
              >
                Remove
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="wishlist-select-row mb-4">
        <input
          type="checkbox"
          checked={selectedItems.length === items.length}
          onChange={toggleSelectAll}
          className="wishlist-checkbox"
          aria-label="Select all wishlist items"
        />
        <span>Select All</span>
      </div>

      <div className="wishlist-items">
        {items.map((item) => (
          <article key={item.id} className="wishlist-item-card product-card deal-card mb-4">
            <ProductCardMedia
              src={item.imageSrc}
              alt={item.name}
              fallback={<span className="deal-emoji">{item.emoji}</span>}
              badges={
                item.discount ? <span className="deal-discount">-{item.discount}%</span> : null
              }
            />

            <div className="wishlist-item-body">
              <div className="wishlist-item-top">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="wishlist-checkbox mt-1"
                    aria-label={`Select ${item.name}`}
                  />
                  <div className="min-w-0">
                    <h3 className="wishlist-item-title">{item.name}</h3>
                    <p className="wishlist-item-store">{item.store}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="wishlist-remove-btn"
                  aria-label={`Remove ${item.name} from wishlist`}
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="wishlist-item-pricing">
                <span className="wishlist-item-price">${item.price.toLocaleString("en-US")}</span>
                {item.originalPrice ? (
                  <span className="wishlist-item-original">
                    ${item.originalPrice.toLocaleString("en-US")}
                  </span>
                ) : null}
                {item.discount > 0 ? (
                  <span className="wishlist-item-badge wishlist-item-badge-discount">
                    -{item.discount}%
                  </span>
                ) : null}
                {item.priceDrop ? (
                  <span className="wishlist-item-badge wishlist-item-badge-drop">
                    <AlertTriangle className="w-3 h-3" />
                    Price Drop!
                  </span>
                ) : null}
              </div>

              <div className="wishlist-item-meta">
                <span className={item.inStock ? "in-stock" : "out-of-stock"}>
                  {item.inStock ? "In Stock" : "Out of Stock"}
                </span>
                <span>⭐ {item.rating}</span>
                <span>Added {item.addedAt}</span>
              </div>

              <ProductCardActions
                productId={item.id}
                shopHref={`/product/${item.id}#compare-prices`}
              />
              <Button variant="outline" size="sm" className="mt-2">
                Set Alert
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Card className="wishlist-alerts-card mt-8">
        <h2>Price Alerts Summary</h2>
        <div className="space-y-3">
          {items
            .filter((item) => item.priceAlert)
            .map((item) => (
              <div key={item.id} className="wishlist-alert-row">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="wishlist-alert-media">
                    <AssetImage
                      src={item.imageSrc}
                      alt=""
                      width={56}
                      height={56}
                      className="product-card-image"
                      fallback={
                        <span className="deal-emoji" style={{ fontSize: 28 }}>
                          {item.emoji}
                        </span>
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{item.name}</p>
                    <p className="text-gray-400 text-sm">
                      Current: ${item.price} • Alert: ${item.priceAlert}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.priceDrop ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="text-sm text-gray-400 whitespace-nowrap">
                    {item.priceDrop ? "Below target!" : "Waiting for drop"}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </Card>

      <section className="wishlist-recommendations mt-10" aria-labelledby="wishlist-rec-heading">
        <h2 id="wishlist-rec-heading" className="text-2xl font-bold text-white mb-6">
          You Might Also Like
        </h2>
        <div className="listing-products-grid">
          {MOCK_SEARCH_ITEMS.slice(0, 4).map((product) => (
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
                inStock: product.inStock,
              }}
              showWishlist={false}
            />
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
