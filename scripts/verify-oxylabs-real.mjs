import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(resolve(".env.local"))) {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { fetchOxylabsAmazonProduct } = await import(
  "@/lib/integrations/oxylabs/client"
);

// Real ASINs confirmed purchasable on each marketplace (from live probing):
const plan = [
  { asin: "B0BDHWDR12", mp: "amazon-storefront", label: "US (com)", expect: "USD" },
  { asin: "B0CHX3QBCH", mp: "amazon-co-uk", label: "UK (co.uk)", expect: "GBP" },
  { asin: "B0BDHWDR12", mp: "amazon-eg", label: "Egypt (eg)", expect: "EGP" },
];

let allOk = true;
for (const { asin, mp, label, expect } of plan) {
  console.log("\n=== " + label + "  ASIN " + asin + " ===");
  try {
    const p = await fetchOxylabsAmazonProduct(asin, mp);
    if (!p) {
      console.error("  ✗ returned null (no usable data)");
      allOk = false;
      continue;
    }
    const ok = p.price > 0 && p.imageUrl.startsWith("http") && p.asin && p.title && p.inStock && p.currency === expect;
    console.log("  title:       " + p.title);
    console.log("  price:       " + p.price + " " + p.currency + (p.originalPrice !== p.price ? " (orig " + p.originalPrice + ")" : ""));
    console.log("  asin:        " + p.asin);
    console.log("  image:       " + p.imageUrl.slice(0, 80));
    console.log("  productUrl:  " + p.productUrl);
    console.log("  inStock:     " + p.inStock + "  rating: " + p.rating + " (" + p.reviewCount + " reviews)");
    console.log((ok ? "  ✓ REAL DATA OK" : "  ✗ MISSING FIELD(S)"));
    if (!ok) allOk = false;
  } catch (e) {
    console.error("  ✗ threw: " + (e instanceof Error ? e.message : e));
    allOk = false;
  }
}

console.log(allOk ? "\nALL MARKETPLACES RETURNED REAL DATA" : "\nSOME MARKETPLACE CHECK(S) FAILED");
process.exit(allOk ? 0 : 1);
