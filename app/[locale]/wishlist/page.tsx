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
import {
  Heart,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const WISHLIST_ITEMS = [
  {
    id: "1",
    name: "iPhone 15 Pro Max 256GB",
    imageSrc: "",
    emoji: "📱",
    price: 999,
    originalPrice: 1199,
    discount: 17,
    store: "Amazon",
    rating: 4.8,
    inStock: true,
    priceAlert: 950,
    priceDrop: false,
    addedAt: "2024-01-10",
  },
  {
    id: "2",
    name: 'MacBook Air M3 13"',
    imageSrc: "",
    emoji: "💻",
    price: 1099,
    originalPrice: 1299,
    discount: 15,
    store: "Apple",
    rating: 4.9,
    inStock: true,
    priceAlert: 1000,
    priceDrop: true,
    addedAt: "2024-01-08",
  },
  {
    id: "3",
    name: "Sony WH-1000XM5 Headphones",
    imageSrc: "",
    emoji: "🎧",
    price: 299,
    originalPrice: 399,
    discount: 25,
    store: "Amazon",
    rating: 4.7,
    inStock: true,
    priceAlert: 250,
    priceDrop: false,
    addedAt: "2024-01-05",
  },
  {
    id: "4",
    name: "Nike Air Jordan 1",
    imageSrc: "",
    emoji: "👟",
    price: 140,
    originalPrice: 180,
    discount: 22,
    store: "Nike",
    rating: 4.8,
    inStock: false,
    priceAlert: 120,
    priceDrop: false,
    addedAt: "2024-01-03",
  },
];

const RECOMMENDED = [
  { id: "rec-1", name: "iPhone 15 Pro", emoji: "📱", price: 999, discount: 12, store: "Amazon" },
  { id: "rec-2", name: "iPhone 15 Pro Max", emoji: "📱", price: 1099, discount: 10, store: "Best Buy" },
  { id: "rec-3", name: "iPhone 15", emoji: "📱", price: 799, discount: 8, store: "Walmart" },
  { id: "rec-4", name: "iPhone 15 Plus", emoji: "📱", price: 899, discount: 14, store: "Target" },
];

export default function WishlistPage() {
  const t = useTranslations("wishlist");
  const { user } = useAuth();
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === WISHLIST_ITEMS.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(WISHLIST_ITEMS.map((item) => item.id));
    }
  };

  const removeSelected = () => {
    setSelectedItems([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t("loginRequired")}</h2>
          <p className="text-gray-400 mb-6">{t("loginToViewWishlist")}</p>
          <Button onClick={() => router.push("/auth/login")}>{t("login")}</Button>
        </div>
      </div>
    );
  }

  if (WISHLIST_ITEMS.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t("emptyWishlist")}</h2>
          <p className="text-gray-400 mb-6">{t("startAddingProducts")}</p>
          <Button onClick={() => router.push("/")}>{t("browseDeals")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="max-w-7xl mx-auto px-4 py-8 page-content">
        <header className="wishlist-header">
          <h1>{t("title")}</h1>
          <p>
            {WISHLIST_ITEMS.length} {WISHLIST_ITEMS.length === 1 ? "item" : "items"} in your wishlist
          </p>
        </header>

        {selectedItems.length > 0 && (
          <Card className="wishlist-selection-bar">
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

        <div className="wishlist-select-row">
          <input
            type="checkbox"
            checked={selectedItems.length === WISHLIST_ITEMS.length}
            onChange={toggleSelectAll}
            className="wishlist-checkbox"
            aria-label="Select all wishlist items"
          />
          <span>Select All</span>
        </div>

        <div className="wishlist-items">
          {WISHLIST_ITEMS.map((item) => (
            <article key={item.id} className="wishlist-item-card product-card deal-card">
              <ProductCardMedia
                src={item.imageSrc}
                alt={item.name}
                fallback={<span className="deal-emoji">{item.emoji}</span>}
                badges={
                  item.discount ? (
                    <span className="deal-discount">-{item.discount}%</span>
                  ) : null
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
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="wishlist-item-pricing">
                  <span className="wishlist-item-price">${item.price.toLocaleString("en-US")}</span>
                  {item.originalPrice && (
                    <span className="wishlist-item-original">
                      ${item.originalPrice.toLocaleString("en-US")}
                    </span>
                  )}
                  {item.discount > 0 && (
                    <span className="wishlist-item-badge wishlist-item-badge-discount">
                      -{item.discount}%
                    </span>
                  )}
                  {item.priceDrop && (
                    <span className="wishlist-item-badge wishlist-item-badge-drop">
                      <AlertTriangle className="w-3 h-3" />
                      Price Drop!
                    </span>
                  )}
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

        <Card className="wishlist-alerts-card">
          <h2>Price Alerts Summary</h2>
          <div className="space-y-3">
            {WISHLIST_ITEMS.filter((item) => item.priceAlert).map((item) => (
              <div key={item.id} className="wishlist-alert-row">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="wishlist-alert-media">
                    <AssetImage
                      src={item.imageSrc}
                      alt=""
                      width={56}
                      height={56}
                      className="product-card-image"
                      fallback={<span className="deal-emoji" style={{ fontSize: 28 }}>{item.emoji}</span>}
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

        <section className="wishlist-recommendations" aria-labelledby="wishlist-rec-heading">
          <h2 id="wishlist-rec-heading">You Might Also Like</h2>
          <div className="listing-products-grid">
            {RECOMMENDED.map((product) => (
              <ListingProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  imageSrc: "",
                  emoji: product.emoji,
                  price: product.price,
                  discount: product.discount,
                  store: product.store,
                  inStock: true,
                }}
                showWishlist={false}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
