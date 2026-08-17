/**
 * Centralized Admitad affiliate / tracking / deep-link registry.
 *
 * Source: user-collected Admitad links (zorino_admitad_links.txt).
 * All URLs are preserved EXACTLY as provided — they are tracking/deep
 * links, NOT coupon codes. Do not invent, modify, shorten, or replace any URL.
 */

export type AdmitadLinkType = "deep_link" | "cps" | "store_page";

export interface AdmitadStoreLink {
  /** Display name exactly as provided in the source file. */
  storeName: string;
  /** Derived slug (kebab-case, lower-cased). */
  storeSlug: string;
  /** The Admitad affiliate / tracking / deep link URL (preserved exactly). */
  affiliateUrl: string;
  /** Targeted GEO regions. "WW" = worldwide / many GEOs. */
  geo: string[];
  /** Link type: deep_link (default), cps (cost-per-sale), or store_page. */
  type: AdmitadLinkType;
  /** Free-form notes from the source label (e.g. "[CPS]", "offline codes"). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// WW / Global / Many-GEO programs
// ---------------------------------------------------------------------------

const WW_PROGRAMS: AdmitadStoreLink[] = [
  {
    storeName: "Alibaba",
    storeSlug: "alibaba",
    affiliateUrl: "https://rzekl.com/g/pm1aev55cl32ef59cc79219aa26f6f/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Ticombo",
    storeSlug: "ticombo",
    affiliateUrl: "https://zmgig.com/g/hn23xca40832ef59cc79bcf92d8d7a/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "VectorStock",
    storeSlug: "vectorstock",
    affiliateUrl: "https://grfpr.com/g/e8s706m24b32ef59cc7969ba13f9ec/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "The Luxury Closet",
    storeSlug: "the-luxury-closet",
    affiliateUrl: "https://ad.admitad.com/g/quh26xvvn832ef59cc794413e8fc1b/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Boardmix",
    storeSlug: "boardmix",
    affiliateUrl: "https://axavl.com/g/3tevoaw5qgq32ef59cc79d12233f6f4/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Geekbuying",
    storeSlug: "geekbuying",
    affiliateUrl: "https://bywiola.com/g/78tuyzaw8k32ef59cc790267b86f6e/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Sunsky-online",
    storeSlug: "sunsky-online",
    affiliateUrl: "https://dorinebeaumont.com/g/7npkd4cs1l32ef59cc79869a299fda/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Gshopper",
    storeSlug: "gshopper",
    affiliateUrl: "https://bywiola.com/g/nx2yncwth632ef59cc79d497214fca/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Hacoo",
    storeSlug: "hacoo",
    affiliateUrl: "https://dorinebeaumont.com/g/84e1j7pvh132ef59cc79f271888eea/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Noracora",
    storeSlug: "noracora",
    affiliateUrl: "https://qwpeg.com/g/of8pqgktr232ef59cc79c8dbeb8f0d/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "ChicMe",
    storeSlug: "chicme",
    affiliateUrl: "https://rzekl.com/g/gf807z8tar32ef59cc79312b8f391a/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Stylevana",
    storeSlug: "stylevana",
    affiliateUrl: "https://grfpr.com/g/zaxgnm7sp332ef59cc79590a2462b6/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Redmagic",
    storeSlug: "redmagic",
    affiliateUrl: "https://yyczo.com/g/qmttmvxh1u32ef59cc7956637026d8/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Tapfiliate",
    storeSlug: "tapfiliate",
    affiliateUrl: "https://ad.admitad.com/g/1sp3lr5uzq32ef59cc79ca80d6a593/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Drippy Custom",
    storeSlug: "drippy-custom",
    affiliateUrl: "https://xpuvo.com/g/5q4v2tbfvw32ef59cc7911c83c348e/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Nadula",
    storeSlug: "nadula",
    affiliateUrl: "https://xpuvo.com/g/oy5ftorbbz32ef59cc7945ffeb074b/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "Cheapvuelos",
    storeSlug: "cheapvuelos",
    affiliateUrl: "https://yknhe.com/g/cmazc4pm8032ef59cc79ce5f810ebf/",
    geo: ["WW"],
    type: "deep_link",
  },
  {
    storeName: "MyHeritage DNA",
    storeSlug: "myheritage-dna",
    affiliateUrl: "https://naiawork.com/g/kmz7w822uc32ef59cc79e403a0fd30/",
    geo: ["WW"],
    type: "deep_link",
  },
];

// ---------------------------------------------------------------------------
// AE / SA / MENA programs
// ---------------------------------------------------------------------------

const AE_SA_PROGRAMS: AdmitadStoreLink[] = [
  {
    storeName: "Yango Drive",
    storeSlug: "yango-drive",
    affiliateUrl: "https://zmgig.com/g/zm0bbusaso32ef59cc79f9ed9c6b58/",
    geo: ["AE"],
    type: "deep_link",
    notes: "promo codes & links",
  },
  {
    storeName: "LG",
    storeSlug: "lg",
    affiliateUrl: "https://zejcl.com/g/efmcw9mw1i32ef59cc79c31d685009/",
    geo: ["SA"],
    type: "store_page",
    notes: "offline codes & links",
  },
  {
    storeName: "Reebok",
    storeSlug: "reebok",
    affiliateUrl: "https://ficca2021.com/g/c03arsuvru32ef59cc79f3199c6ed1/",
    geo: ["AE"],
    type: "deep_link",
    notes: "UAE links and tracking promo codes",
  },
  {
    storeName: "DKNY",
    storeSlug: "dkny",
    affiliateUrl: "https://plrvq.com/g/o8vhdobxgs32ef59cc79414deb9469/",
    geo: ["AE", "SA", "KW"],
    type: "deep_link",
    notes: "links & coupons",
  },
  {
    storeName: "Eyewa",
    storeSlug: "eyewa",
    affiliateUrl: "https://dorinebeaumont.com/g/5brfq9vg0i32ef59cc79b7da7466f8/",
    geo: ["AE", "SA", "KW", "QA", "OM"],
    type: "store_page",
    notes: "offline codes",
  },
  {
    storeName: "Diesel",
    storeSlug: "diesel",
    affiliateUrl: "https://bywiola.com/g/idw1vvlz5l32ef59cc798716e55fa2/",
    geo: ["AE", "SA", "KW"],
    type: "store_page",
    notes: "offline codes & links",
  },
  {
    storeName: "The Deal Outlet",
    storeSlug: "the-deal-outlet",
    affiliateUrl: "https://bywiola.com/g/wjw0v6sq2u32ef59cc79b6c5579bcf/",
    geo: ["AE", "SA"],
    type: "deep_link",
  },
  {
    storeName: "Clarks",
    storeSlug: "clarks",
    affiliateUrl: "https://codeaven.com/g/x51pfgqns932ef59cc79ea2a6e1fef/",
    geo: ["AE"],
    type: "store_page",
    notes: "offline codes & links",
  },
  {
    storeName: "Huawei",
    storeSlug: "huawei",
    affiliateUrl: "https://ficca2021.com/g/2k0ixkhyho32ef59cc79fc61652cc0/",
    geo: ["AE"],
    type: "store_page",
    notes: "offline codes & links",
  },
];

// ---------------------------------------------------------------------------
// Other regional programs (MX, CZ, UA, IN)
// ---------------------------------------------------------------------------

const REGIONAL_PROGRAMS: AdmitadStoreLink[] = [
  {
    storeName: "Whirlpool",
    storeSlug: "whirlpool",
    affiliateUrl: "https://rzekl.com/g/hkjqq2fi8q32ef59cc7982ed2bb6aa/",
    geo: ["MX", "CO"],
    type: "deep_link",
  },
  {
    storeName: "Huawei",
    storeSlug: "huawei-cz",
    affiliateUrl: "https://lsuix.com/g/vg5a5px7gy32ef59cc7921c22008e4/",
    geo: ["CZ"],
    type: "deep_link",
  },
  {
    storeName: "Crocs",
    storeSlug: "crocs",
    affiliateUrl: "https://xcdus.com/g/rq9y2no5ye32ef59cc7968158a2a3f/",
    geo: ["UA"],
    type: "deep_link",
    notes: "shoes",
  },
  {
    storeName: "Samsonite",
    storeSlug: "samsonite",
    affiliateUrl: "https://xmknb.com/g/cj6zaw6m9p32ef59cc79a68f2598b9/",
    geo: ["MX"],
    type: "deep_link",
  },
  {
    storeName: "Blackberrys",
    storeSlug: "blackberrys",
    affiliateUrl: "https://tjzuh.com/g/lv4rd63bk232ef59cc79d42ea64a2c/",
    geo: ["IN"],
    type: "cps",
    notes: "new [CPS]",
  },
  {
    storeName: "Bliss Club",
    storeSlug: "bliss-club",
    affiliateUrl: "https://tjzuh.com/g/f7dkjuc7zj32ef59cc79519b939af8/",
    geo: ["IN"],
    type: "cps",
    notes: "[CPS]",
  },
  {
    storeName: "Salty",
    storeSlug: "salty",
    affiliateUrl: "https://tjzuh.com/g/9idoi1gyuy32ef59cc790c509bedc5/",
    geo: ["IN"],
    type: "cps",
    notes: "[CPS]",
  },
  {
    storeName: "Palmonas",
    storeSlug: "palmonas",
    affiliateUrl: "https://tjzuh.com/g/cozq2t2pxu32ef59cc7948f53de592/",
    geo: ["IN"],
    type: "cps",
    notes: "[CPS]",
  },
  {
    storeName: "Lifestyle",
    storeSlug: "lifestyle",
    affiliateUrl: "https://tjzuh.com/g/xjyf9hlt0t32ef59cc79fb440ec775/",
    geo: ["IN"],
    type: "cps",
    notes: "web [CPS]",
  },
  {
    storeName: "Nilkamal",
    storeSlug: "nilkamal",
    affiliateUrl: "https://tjzuh.com/g/0r8jdq3sst32ef59cc79c70051888a/",
    geo: ["IN"],
    type: "cps",
    notes: "[CPS]",
  },
  {
    storeName: "Nveda",
    storeSlug: "nveda",
    affiliateUrl: "https://tjzuh.com/g/cyo8uq9j7332ef59cc79132f2e20b3/",
    geo: ["IN"],
    type: "cps",
    notes: "[CPS]",
  },
  {
    storeName: "Touch",
    storeSlug: "touch",
    affiliateUrl: "https://wbbsv.com/g/ynys1f2mjp32ef59cc790e81904d8b/",
    geo: ["UA"],
    type: "deep_link",
  },
  {
    storeName: "Miravia",
    storeSlug: "miravia",
    affiliateUrl: "https://sgkaa.com/g/7xeenx9ms232ef59cc79903dd028f6/",
    geo: ["ES", "PT"],
    type: "deep_link",
  },
];

// ---------------------------------------------------------------------------
// Combined registry (ordered: WW first, then AE/SA, then regional)
// ---------------------------------------------------------------------------

export const ADMITAD_STORE_LINKS: AdmitadStoreLink[] = [
  ...WW_PROGRAMS,
  ...AE_SA_PROGRAMS,
  ...REGIONAL_PROGRAMS,
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** All unique store slugs in the registry. */
export const ADMITAD_STORE_SLUGS = [
  ...new Set(ADMITAD_STORE_LINKS.map((l) => l.storeSlug)),
];

/**
 * Look up all Admitad links for a given store slug.
 * Returns an empty array if the store has no Admitad links.
 */
export function getAdmitadLinksBySlug(slug: string): AdmitadStoreLink[] {
  return ADMITAD_STORE_LINKS.filter((l) => l.storeSlug === slug);
}

/**
 * Look up a single Admitad link by store slug and optional GEO filter.
 * Returns the first match when geo is omitted.
 */
export function getAdmitadLink(
  slug: string,
  geo?: string,
): AdmitadStoreLink | undefined {
  return ADMITAD_STORE_LINKS.find(
    (l) =>
      l.storeSlug === slug &&
      (geo ? l.geo.includes(geo) : true),
  );
}
