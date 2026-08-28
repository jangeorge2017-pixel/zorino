#!/usr/bin/env node
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

const username = process.env.OXYLABS_USERNAME?.trim();
const password = process.env.OXYLABS_PASSWORD?.trim();
const asin = process.env.OXYLABS_TEST_ASIN?.trim() || "B08N5WRWNW";

if (!username || !password) {
  console.error("Oxylabs credentials not configured.");
  console.error("Set OXYLABS_USERNAME and OXYLABS_PASSWORD in .env.local");
  process.exit(1);
}

const endpoint = "https://realtime.oxylabs.io/v1/queries";
const auth = Buffer.from(`${username}:${password}`).toString("base64");

const domains = [
  { domain: "com", label: "US", expectedHost: "amazon.com", locale: "en_US", geo: "10001" },
  { domain: "co.uk", label: "UK", expectedHost: "amazon.co.uk", locale: "en_GB", geo: "SW1A1AA" },
  { domain: "eg", label: "Egypt", expectedHost: "amazon.eg", locale: "en_AE", geo: "11511" },
];

let allOk = true;

function unwrapContent(content) {
  if (Array.isArray(content)) return content[0] ?? null;
  return content;
}

for (const { domain, label, expectedHost, locale, geo } of domains) {
  console.log(`\n=== Amazon ${label} (domain: ${domain}, ASIN: ${asin}) ===`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        source: "amazon_product",
        domain,
        query: asin,
        parse: true,
        geo_location: geo,
        locale,
        context: [{ key: "autoselect_variant", value: true }],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`✗ HTTP ${response.status}: ${text.slice(0, 300)}`);
      allOk = false;
      continue;
    }

    const data = await response.json();
    const rawContent = data.results?.[0]?.content;
    const content = unwrapContent(rawContent);

    if (!content) {
      console.error("✗ No content in response");
      allOk = false;
      continue;
    }

    const title = (content.title ?? content.product_name ?? "").trim();
    const price = content.price_buybox ?? content.price ?? 0;
    const priceInitial = content.price_initial ?? 0;
    const imageUrl = (content.images ?? []).find((u) => u.startsWith("http")) ?? "";
    const productUrl = (content.url ?? "").trim();

    const checks = [
      ["title", title.length > 0],
      ["price", price > 0],
      ["ASIN", (content.asin ?? "").trim().length > 0],
      ["image", imageUrl.startsWith("http")],
      ["productUrl", productUrl.includes(expectedHost)],
    ];

    for (const [name, ok] of checks) {
      console.log(ok ? `✓ ${name}` : `✗ ${name}`);
      if (!ok) allOk = false;
    }

    console.log(`  title: ${title.slice(0, 80)}`);
    console.log(`  price: ${price} ${content.currency ?? ""}`);
    console.log(`  originalPrice: ${priceInitial}`);
    console.log(`  ASIN: ${content.asin}`);
    console.log(`  image: ${imageUrl.slice(0, 80)}`);
    console.log(`  productUrl: ${productUrl}`);
    console.log(`  stock: ${content.stock ?? content.availability ?? "unknown"}`);
    console.log(`  rating: ${content.rating ?? 0} (${content.reviews_count ?? 0} reviews)`);
  } catch (err) {
    console.error(`✗ Request failed: ${err instanceof Error ? err.message : err}`);
    allOk = false;
  }
}

console.log(allOk ? "\nAll Oxylabs Amazon checks passed." : "\nSome checks failed.");
process.exit(allOk ? 0 : 1);
