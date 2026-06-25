#!/usr/bin/env node
/**
 * Seed Zorino Supabase with homepage stores, products, deals, coupons, and price history.
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stores = [
  {
    slug: "amazon",
    name: "Amazon",
    logo_url: "/stores/amazon.png",
    logo_initial: "a",
    website: "https://amazon.com",
    integration_type: "amazon",
    supported_regions: ["US", "GB", "DE"],
    supported_currencies: ["USD", "GBP", "EUR"],
  },
  {
    slug: "best-buy",
    name: "Best Buy",
    logo_url: "/stores/best-buy.png",
    logo_initial: "BB",
    website: "https://bestbuy.com",
    integration_type: "partner",
    supported_regions: ["US"],
    supported_currencies: ["USD"],
  },
  {
    slug: "walmart",
    name: "Walmart",
    logo_url: "/stores/walmart.png",
    logo_initial: "W",
    website: "https://walmart.com",
    integration_type: "walmart",
    supported_regions: ["US"],
    supported_currencies: ["USD"],
  },
  {
    slug: "foot-locker",
    name: "Foot Locker",
    logo_url: "/stores/foot-locker.png",
    logo_initial: "FL",
    website: "https://footlocker.com",
    integration_type: "partner",
    supported_regions: ["US", "GB"],
    supported_currencies: ["USD", "GBP"],
  },
  {
    slug: "noon",
    name: "Noon",
    logo_url: "/stores/noon.png",
    logo_initial: "N",
    website: "https://noon.com",
    integration_type: "noon",
    supported_regions: ["AE", "SA"],
    supported_currencies: ["AED", "SAR"],
  },
  {
    slug: "aliexpress",
    name: "AliExpress",
    logo_url: "/stores/aliexpress.png",
    logo_initial: "AE",
    website: "https://aliexpress.com",
    integration_type: "aliexpress",
    supported_regions: ["US", "GB", "AE", "SA"],
    supported_currencies: ["USD", "GBP", "AED", "SAR"],
  },
  {
    slug: "nike",
    name: "Nike",
    logo_url: "/stores/nike.png",
    logo_initial: "✓",
    website: "https://nike.com",
    integration_type: "shopify",
    supported_regions: ["US", "GB", "DE"],
    supported_currencies: ["USD", "GBP", "EUR"],
  },
];

const products = [
  {
    slug: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    image_url: "/products/deal-iphone.png",
    emoji: "📱",
    category_slug: "phones",
    brand: "Apple",
    rating: 4.8,
    review_count: 2847,
    store_slug: "amazon",
    price: 899,
    original_price: 1029,
    discount: 12,
    price_history: [980, 960, 940, 920, 899],
    sort_order: 1,
  },
  {
    slug: "macbook-air-m3",
    name: "MacBook Air M3",
    image_url: "/products/deal-macbook.png",
    emoji: "💻",
    category_slug: "laptops",
    brand: "Apple",
    rating: 4.9,
    review_count: 1523,
    store_slug: "best-buy",
    price: 1099,
    original_price: 1299,
    discount: 15,
    price_history: [1250, 1200, 1150, 1120, 1099],
    sort_order: 2,
  },
  {
    slug: "playstation-5",
    name: "PlayStation 5",
    image_url: "/products/deal-ps5.png",
    emoji: "🎮",
    category_slug: "gaming",
    brand: "Sony",
    rating: 4.9,
    review_count: 8901,
    store_slug: "walmart",
    price: 449,
    original_price: 499,
    discount: 10,
    price_history: [490, 480, 470, 460, 449],
    sort_order: 3,
  },
  {
    slug: "nike-air-jordan-1",
    name: "Nike Air Jordan 1",
    image_url: "/products/deal-nike.png",
    emoji: "👟",
    category_slug: "fashion",
    brand: "Nike",
    rating: 4.6,
    review_count: 4210,
    store_slug: "foot-locker",
    price: 129,
    original_price: 160,
    discount: 20,
    price_history: [155, 148, 140, 135, 129],
    sort_order: 4,
  },
];

const coupons = [
  {
    store_slug: "amazon",
    code: "SAVE10",
    title: "Amazon Sitewide",
    offer: "10% OFF Sitewide",
    min_spend: "Min spend $50",
    discount: 10,
    used_times: 24532,
  },
  {
    store_slug: "noon",
    code: "NOON15",
    title: "Noon Electronics",
    offer: "15% OFF Electronics",
    min_spend: "Min spend $100",
    discount: 15,
    used_times: 8721,
  },
  {
    store_slug: "aliexpress",
    code: "AE50OFF",
    title: "AliExpress Orders",
    offer: "$50 OFF Orders $200+",
    min_spend: "Min spend $200",
    discount: 50,
    discount_type: "fixed",
    used_times: 5623,
  },
  {
    store_slug: "nike",
    code: "NIKE20",
    title: "Nike Full Price",
    offer: "20% OFF Full Price Items",
    min_spend: "No minimum",
    discount: 20,
    used_times: 9834,
  },
];

async function upsertStores() {
  const { data, error } = await supabase.from("stores").upsert(stores, { onConflict: "slug" }).select();
  if (error) throw error;
  const map = new Map(data.map((s) => [s.slug, s.id]));
  console.log(`✓ ${data.length} stores`);
  return map;
}

async function seedProducts(storeMap) {
  for (const p of products) {
    const storeId = storeMap.get(p.store_slug);
    if (!storeId) continue;

    const { data: product, error: productError } = await supabase
      .from("products")
      .upsert(
        {
          slug: p.slug,
          name: p.name,
          image_url: p.image_url,
          emoji: p.emoji,
          category_slug: p.category_slug,
          brand: p.brand,
          rating: p.rating,
          review_count: p.review_count,
          currency: "USD",
          country_code: "US",
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (productError) throw productError;

    await supabase.from("prices").upsert(
      {
        product_id: product.id,
        store_id: storeId,
        price: p.price,
        original_price: p.original_price,
        currency: "USD",
        country_code: "US",
        is_current: true,
      },
      { onConflict: "product_id,store_id,country_code,currency" }
    );

    for (const price of p.price_history) {
      await supabase.from("price_history").delete().eq("product_id", product.id);
      break;
    }
    for (const price of p.price_history) {
      await supabase.from("price_history").insert({
        product_id: product.id,
        store_id: storeId,
        price,
        currency: "USD",
      });
    }

    await supabase.from("deals").delete().eq("product_id", product.id);
    const { error: dealError } = await supabase.from("deals").insert({
      product_id: product.id,
      store_id: storeId,
      title: p.name,
      discount: p.discount,
      price: p.price,
      original_price: p.original_price,
      currency: "USD",
      country_code: "US",
      is_featured: true,
      is_active: true,
      sort_order: p.sort_order,
    });

    if (dealError) throw dealError;

    console.log(`✓ ${p.name}`);
  }
}

async function seedCoupons(storeMap) {
  for (const c of coupons) {
    const storeId = storeMap.get(c.store_slug);
    if (!storeId) continue;

    const { error } = await supabase.from("coupons").upsert(
      {
        store_id: storeId,
        code: c.code,
        title: c.title,
        offer: c.offer,
        min_spend: c.min_spend,
        discount: c.discount,
        discount_type: c.discount_type ?? "percentage",
        currency: "USD",
        used_times: c.used_times,
        verified: true,
        is_active: true,
      },
      { onConflict: "code" }
    );

    if (error) throw error;
    console.log(`✓ coupon ${c.code}`);
  }
}

async function main() {
  console.log("Seeding Zorino database…");
  const storeMap = await upsertStores();
  await seedProducts(storeMap);
  await seedCoupons(storeMap);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
