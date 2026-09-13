# ZORINO — UI/UX Snapshot (Phase 0 baseline)

Reference: `docs/baseline/ui/*.png` (read-only production captures) + this structural map.
Locales: `en` (default) and `ar`; URL is source of truth.

## 1. Routes

| Route | Component/page (server) | Client islands | Data source (server) |
|---|---|---|---|
| `/` `/en` `/ar` | `ZorinoHomePage` | Hero, Search, DealsPanel, TrendingDealCard, Footer, FeaturedCouponBrands | `getHomepageSectionProducts`, `getTrendingDeals`, `getDealsForPage`, `getHomepageStats` |
| `/search` | `SearchPageClient` (first page) | paging via `/api/search/paged` | `searchProducts(q, 200)` + `getSearchFilters` |
| `/product/[id]` | PDP server resolver + client renderer | outbound redirect island | `marketplace-product-detail.ts` |
| `/compare` | server assembles + `ComparePageClient` | — | `searchProducts(COMPARE_QUERIES, 4)` + enrichment |
| `/stores/[slug]`, `/deals`, `/products` | store/deals catalog pages | — | DB read paths + `StoresPageClient` |

## 2. Primary data contracts to the UI (frozen)

- **SearchResultItem** (lib/data/homepage.ts): id, name, imageSrc, emoji, price, originalPrice,
  discount, store, storeSlug, rating, reviewCount, salesCount?, shipping?, inStock, category,
  currency?, countryCode?, affiliateUrl?.
- **NormalizedCatalogItem** (lib/integration/catalog-types.ts): id, slug, title, imageUrl, emoji,
  categorySlug, rating, reviewCount, countryCode, currency, price, originalPrice, discount,
  discountType, offers[], providerIds[], fetchedAt.
- **Compare**: `CompareProductResult`/`CompareOffer` (lib/providers/schema) used as UI shape;
  `PriceComparisonSummary` (lib/search/price-comparison).

## 3. Provider/store identity rendered in UI (baseline — contains hardcoded spots)

- `ListingProductCard`: `marketplaceBadgeLabel` map (aliexpress/ebay/amazon/amazon-eg/walmart/temu/
  noon/jumia/best-buy/nike/apple/foot-locker).
- `ZorinoHomeFooter` `FEATURED_STORES`: aliexpress, ebay, admitad (`/stores/alibaba.svg`), cjdropshipping.
- `ZorinoHomeFeaturedCouponBrands`: 10 brand logos (live coupons win; static fallback text only).
- `RecommendedProductsContainer` subtitle hardcodes "AliExpress, eBay, and CJdropshipping".
- `/stores/[slug]` `STORE_META` (aliexpress/amazon/amazon-eg/ebay/noon/walmart/best-buy); `StoresPageClient`
  `MARKETPLACE_TYPES` (temu/amazon-eg missing).
- PDP JSON-LD store name ternary (amazon vs amazon-eg).
- Search filters labels ternary in `services/aliexpress/search.ts` (`AliExpress`/`eBay`/`Amazon`).
- NOTE: These are intentional baseline captures; the re-architecture must keep the rendered UI/UX
  identical while de-duplicating identity into the registry.

## 4. Screenshots (read-only captures from production — visual reference)

Captured 2026-09-07 (read-only). See `docs/baseline/ui/`:
| File | Page | Notes |
|---|---|---|
| `home-en.png` | `zorino.org/en` (→ www root) | hero + sections |
| `home-ar.png` | `zorino.org/ar` | RTL |
| `search-iphone-en.png` | `/en/search?q=iphone` | live multi-provider results |
| `product-iphonese-aliexpress.png` | `/product/aliexpress-3256812569446806` | PDP + compare anchor (Apple iPhone SE, AliExpress offer) |
| `compare-en.png` | `/en/compare` | Compare Prices page |

Note: production normalizes `/en` to `/` (www) on apex; locale/URL routing is Vercel-native.

Verification intent: after re-architecture, these screenshots are the visual diff reference —
rendered UI must not change.