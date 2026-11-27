import { createClient } from "@supabase/supabase-js";

const REQUIRED_STORES = [
  {
    slug: "amazon",
    name: "Amazon US",
    logo_url: "/stores/amazon.png",
    logo_initial: "AZ",
    website: "https://www.amazon.com",
    integration_type: "amazon",
    commission_rate: 4.0,
    supported_regions: ["US"],
    supported_currencies: ["USD"],
  },
  {
    slug: "amazon-eg",
    name: "Amazon Egypt",
    logo_url: "/stores/amazon.png",
    logo_initial: "AZ",
    website: "https://www.amazon.eg",
    integration_type: "amazon",
    commission_rate: 4.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
  {
    slug: "noon",
    name: "Noon Egypt",
    logo_url: "/stores/noon.png",
    logo_initial: "N",
    website: "https://www.noon.com/egypt-en",
    integration_type: "noon",
    commission_rate: 5.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
  {
    slug: "jumia",
    name: "Jumia Egypt",
    logo_url: "/stores/jumia.png",
    logo_initial: "J",
    website: "https://www.jumia.com.eg",
    integration_type: "custom",
    commission_rate: 5.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
  {
    slug: "carrefour",
    name: "Carrefour Egypt",
    logo_url: "/stores/carrefour.png",
    logo_initial: "C",
    website: "https://www.carrefouregypt.com",
    integration_type: "custom",
    commission_rate: 4.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
  {
    slug: "btech",
    name: "B-Tech",
    logo_url: "/stores/btech.png",
    logo_initial: "B",
    website: "https://www.btech.com",
    integration_type: "custom",
    commission_rate: 4.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
  {
    slug: "temu",
    name: "Temu",
    logo_url: "/stores/temu.svg",
    logo_initial: "TM",
    website: "https://www.temu.com",
    integration_type: "temu",
    commission_rate: 7.0,
    supported_regions: ["US", "EG"],
    supported_currencies: ["USD", "EGP"],
  },
  {
    slug: "aliexpress",
    name: "AliExpress",
    logo_url: "/stores/aliexpress.png",
    logo_initial: "AE",
    website: "https://www.aliexpress.com",
    integration_type: "aliexpress",
    commission_rate: 6.0,
    supported_regions: ["US", "EG"],
    supported_currencies: ["USD", "EGP"],
  },
  {
    slug: "ebay",
    name: "eBay",
    logo_url: "/stores/ebay.png",
    logo_initial: "E",
    website: "https://www.ebay.com",
    integration_type: "ebay",
    commission_rate: 5.0,
    supported_regions: ["US", "EG"],
    supported_currencies: ["USD", "EGP"],
  },
  {
    slug: "raneen",
    name: "Raneen",
    logo_url: "/stores/raneen.png",
    logo_initial: "RN",
    website: "https://www.raneen.com",
    integration_type: "custom",
    commission_rate: 4.0,
    supported_regions: ["EG"],
    supported_currencies: ["EGP"],
  },
];

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn("[verify-scraper-stores] Supabase credentials unavailable; skipped");
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = REQUIRED_STORES.map((store) => ({
  ...store,
  is_active: true,
  sync_enabled: true,
  sync_interval_minutes: 240,
  updated_at: new Date().toISOString(),
}));

const { error: upsertError } = await db
  .from("stores")
  .upsert(rows, { onConflict: "slug" });

if (upsertError) {
  console.error(`[verify-scraper-stores] enable failed: ${upsertError.message}`);
  process.exit(1);
}

const { data, error } = await db
  .from("stores")
  .select("slug, is_active, sync_enabled")
  .in(
    "slug",
    REQUIRED_STORES.map((store) => store.slug),
  );

if (error) {
  console.error(`[verify-scraper-stores] query failed: ${error.message}`);
  process.exit(1);
}

const bySlug = new Map((data ?? []).map((row) => [row.slug, row]));
const problems = [];

for (const store of REQUIRED_STORES) {
  const row = bySlug.get(store.slug);
  if (!row) {
    problems.push(`${store.slug}: missing store row`);
    continue;
  }
  if (row.sync_enabled !== true) problems.push(`${store.slug}: sync_enabled=${row.sync_enabled}`);
  if (row.is_active !== true) problems.push(`${store.slug}: is_active=${row.is_active}`);
  console.log(
    `[verify-scraper-stores] ${store.slug}: sync_enabled=${row.sync_enabled} is_active=${row.is_active}`,
  );
}

if (problems.length > 0) {
  console.error(`[verify-scraper-stores] failed: ${problems.join("; ")}`);
  process.exit(1);
}

console.log("[verify-scraper-stores] all scraper stores enabled");
