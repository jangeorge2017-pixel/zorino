# Zorino Data Layer

Production-ready, provider-agnostic marketplace data access for Zorino.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ProviderManager                          │
│  cache → rate limit → queue → retry → provider → logging    │
└──────────────────────────┬──────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
  AmazonProvider      eBayProvider (live)    NoonProvider  …
  (stub)              AliExpress (live)
```

Each provider is **independent** and implements `IDataProvider`. Live HTTP clients
will override the protected `fetch*` methods in `BaseDataProvider` without changing
the manager or UI.

## Supported providers

| ID | Name | Regions |
|----|------|---------|
| `amazon` | Amazon | US, UK, DE, AE, SA, EG, CA |
| `ebay` | eBay | US, UK, DE, AU, CA |
| `aliexpress` | AliExpress | Global, US, UK, AE, SA, EG |
| `walmart` | Walmart | US, CA |
| `best-buy` | Best Buy | US, CA |
| `noon` | Noon | AE, SA, EG |
| `jarir` | Jarir | SA, AE |
| `extra` | eXtra | SA, AE |
| `btech` | B.TECH | EG |
| `raya` | Raya Shop | EG |

## Unified interfaces

All providers expose the same methods:

- `getProducts(params?)`
- `getProductById(id, params?)`
- `getStores(params?)`
- `getPrices(params?)`
- `getCoupons(params?)`
- `getCategories(params?)`

Return type: `ProviderResult<T>` with `success`, `data`, `error`, and `meta`.

Entity types reuse `lib/types/entities.ts` (`Product`, `Store`, `Price`, `Coupon`, `Category`).

## Usage

```typescript
import { getProviderManager } from "@/lib/data-layer";

const manager = getProviderManager();

// Route by provider ID
const products = await manager.getProducts("noon", {
  countryCode: "AE",
  limit: 24,
});

// Route by store slug
const provider = manager.resolveByStoreSlug("amazon");
if (provider) {
  const prices = await manager.getPrices("amazon", { productId: "abc123" });
}

// Health check (admin / cron)
const health = manager.getHealthSummary();
```

## Infrastructure layers

| Layer | Module | Purpose |
|-------|--------|---------|
| Cache | `core/cache.ts` | In-memory TTL cache (swap for Redis later) |
| Rate limit | `core/rate-limit.ts` | Per-provider sliding window |
| Queue | `core/queue.ts` | Serializes burst requests per provider |
| Retry | `core/retry.ts` | Exponential backoff for retryable errors |
| Errors | `core/errors.ts` | Normalized `DataLayerError` codes |
| Logging | `core/logger.ts` | Structured JSON logs (secrets never logged) |
| Env | `config/env.ts` | Safe env reads with placeholder detection |

## Environment variables

Global data layer settings (see `.env.example`):

```
DATA_LAYER_ENABLED=true
DATA_LAYER_CACHE_TTL_MS=300000
DATA_LAYER_RATE_LIMIT_PER_MIN=60
DATA_LAYER_MAX_RETRIES=3
DATA_LAYER_RETRY_BASE_MS=500
DATA_LAYER_QUEUE_MAX_PENDING=100
DATA_LAYER_LOG_LEVEL=info
```

Provider credentials are defined per provider in `config/providers.ts`.
Until keys are set, providers return `NOT_CONFIGURED` without calling external APIs.

## Adding a new provider

1. Add ID to `types/provider.ts` → `dataProviderIds`
2. Add metadata to `config/providers.ts` → `PROVIDER_REGISTRY`
3. Add store slug mapping in `STORE_SLUG_TO_PROVIDER`
4. Create provider: `providers/my-store.ts` extending `BaseDataProvider`
5. Register in `providers/index.ts`
6. Add env keys to `.env.example`

## Production providers (AliExpress + eBay)

`aliexpress` and `ebay` data-layer providers are **live** — they delegate to
`lib/sync/providers` HTTP clients when credentials are configured.

The **integration catalog layer** (`lib/integration/`) normalizes both providers into
`NormalizedCatalogItem`, merges cross-provider offers via the comparison engine, and
feeds homepage sections + `/deals` when Supabase has no imported catalog yet.

```typescript
import { fetchMergedCatalog } from "@/lib/integration";
import { getProviderManager } from "@/lib/data-layer";

const { items } = await fetchMergedCatalog();
const manager = getProviderManager();
const products = await manager.getProductsFromProductionProviders({ limit: 24 });
```

## Integration points

- **Homepage / deals**: `lib/data/homepage.ts` → Supabase first, then `lib/integration/catalog-service`
- **Search**: `getSearchResults()` → live AliExpress Affiliates API (`ALIEXPRESS_APP_KEY` / `ALIEXPRESS_APP_SECRET`), then catalog, then mock fallback
- **Data layer**: `getProductsFromProductionProviders()` for AliExpress + eBay fan-out
- **Sync pipeline**: Same mappers used for DB import and live reads

## Current status

- **AliExpress search**: Live via `aliexpress.affiliate.product.query` when credentials are set; falls back to catalog/mock on failure
- **AliExpress + eBay catalog**: Live when `ALIEXPRESS_*` / `EBAY_*` credentials are set
- **Other providers**: Stub mode — return `NOT_CONFIGURED` until implemented
