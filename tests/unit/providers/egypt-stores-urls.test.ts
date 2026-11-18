import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAffiliateUrl,
  normalizeEgyptStoreProductUrl,
} from "@/lib/integrations/egypt-stores/affiliate";
import {
  extractJumiaProductUrlsFromSearchHtml,
  parseJumiaJsonLd,
  parseJumiaPage,
} from "@/lib/integrations/egypt-stores/adapters/jumia";
import { isAllowedAffiliateDestination } from "@/lib/affiliate/redirect-policy";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";
import { resolveUrl } from "@/lib/integrations/egypt-stores/parse";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Egyptian store URL normalization", () => {
  it("repairs backslash-escaped absolute URLs", () => {
    expect(
      resolveUrl(
        "https:\\/\\/www.carrefouregypt.com\\/mafegy\\/en\\/p\\/123",
        "https://www.carrefouregypt.com",
      ),
    ).toBe("https://www.carrefouregypt.com/mafegy/en/p/123");
  });

  it("repairs backslash-escaped relative paths", () => {
    expect(
      resolveUrl("\\/mafegy\\/en\\/p\\/123", "https://www.carrefouregypt.com"),
    ).toBe("https://www.carrefouregypt.com/mafegy/en/p/123");
  });

  it("repairs a URL embedded inside another URL", () => {
    expect(
      normalizeEgyptStoreProductUrl(
        "carrefour",
        "https://www.carrefouregypt.com/https://www.carrefouregypt.com/mafegy/en/p/123",
      ),
    ).toBe("https://www.carrefouregypt.com/mafegy/en/p/123");
  });

  it("returns clean absolute https direct links when affiliate env is empty", () => {
    const cases = [
      {
        store: "Jumia",
        env: "JUMIA_AFF_PREFIX",
        raw: "\\/iphone-15.html",
        expected: "https://www.jumia.com.eg/iphone-15.html",
      },
      {
        store: "Noon",
        env: "NOON_AFF_TAG",
        raw: "\\/egypt-en\\/iphone-15\\/N1\\/p\\/",
        expected: "https://www.noon.com/egypt-en/iphone-15/N1/p/",
      },
      {
        store: "Carrefour",
        env: "CARREFOUR_AFF_TAG",
        raw: "\\/mafegy\\/en\\/p\\/123",
        expected: "https://www.carrefouregypt.com/mafegy/en/p/123",
      },
      {
        store: "B.TECH",
        env: "BTECH_AFF_TAG",
        raw: "\\/en\\/p\\/iphone-15",
        expected: "https://btech.com/en/p/iphone-15",
      },
      {
        store: "2B",
        env: "TWOB_AFF_TAG",
        raw: "\\/en\\/iphone-15.html",
        expected: "https://2b.com.eg/en/iphone-15.html",
      },
    ] as const;

    for (const entry of cases) {
      vi.stubEnv(entry.env, "");
      expect(buildAffiliateUrl(entry.store, entry.raw)).toBe(entry.expected);
    }
  });
});

describe("Jumia JSON-LD fallback", () => {
  it("parses Product nodes from an ItemList page", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          mainEntity: {
            "@type": "ItemList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                item: {
                  "@type": "Product",
                  name: "iPhone 15",
                  url: "https://www.jumia.com.eg/iphone-15-123.html",
                  image: "https://eg.jumia.is/product/1.jpg",
                  offers: {
                    "@type": "Offer",
                    price: "45000.00",
                    priceCurrency: "EGP",
                    availability: "http://schema.org/InStock",
                  },
                  aggregateRating: { ratingValue: 4.5, ratingCount: 12 },
                },
              },
            ],
          },
        },
      ],
    })}</script>`;

    const [item] = parseJumiaJsonLd(html);
    expect(item).toMatchObject({
      providerId: "jumia",
      externalId: "iphone-15-123",
      title: "iPhone 15",
      price: 45000,
      currency: "EGP",
      inStock: true,
      rating: 4.5,
      reviewCount: 12,
      productUrl: "https://www.jumia.com.eg/iphone-15-123.html",
    });
  });

  it("deduplicates JSON-LD products already parsed from HTML cards", () => {
    const html = `
      <article class="prd _fb col c-prd" data-moengage-product_image="https://www.jumia.com.eg/iphone.jpg">
        <a class="core" href="/iphone-15.html" data-gtm-id="J1" data-gtm-name="iPhone 15" data-gtm-price="762.71"></a>
        <div class="prc _inl">EGP 45,000.00</div>
      </article>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "iPhone 15",
        url: "https://www.jumia.com.eg/iphone-15.html",
        image: "https://www.jumia.com.eg/iphone.jpg",
        offers: { "@type": "Offer", price: "45000.00", priceCurrency: "EGP" },
      })}</script>`;

    const items = parseJumiaPage(html);
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("J1");
    expect(items[0]?.price).toBe(45000);
  });

  it("rejects JSON-LD offers that are not priced in EGP", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "iPhone 15",
      url: "https://www.jumia.com.eg/iphone-15.html",
      image: "https://www.jumia.com.eg/iphone.jpg",
      offers: { "@type": "Offer", price: "762.71", priceCurrency: "USD" },
    })}</script>`;

    expect(parseJumiaJsonLd(html)).toHaveLength(0);
  });
});

describe("Egyptian storefront affiliate destinations", () => {
  it("allowlists native product URLs for every Egyptian store", () => {
    const productUrls = [
      "https://www.jumia.com.eg/apple-iphone-15-128gb-123456.html",
      "https://www.noon.com/egypt-en/apple-iphone-15-128gb/p/?o=abc123",
      "https://www.carrefouregypt.com/mafegy/en/p/123",
      "https://btech.com/en/iphone-15-128gb",
      "https://2b.com.eg/en/iphone-15.html",
      "https://www.dubaiphone.net/iphone-15",
      "https://www.raneen.com/iphone-15",
      "https://eldokan.com/iphone-15",
    ];

    for (const url of productUrls) {
      expect(isValidProductDestinationUrl(url)).toBe(true);
      expect(isAllowedAffiliateDestination(url)).toBe(true);
    }
  });

  it("still rejects homepages and search pages on those hosts", () => {
    expect(isAllowedAffiliateDestination("https://www.jumia.com.eg/")).toBe(false);
    expect(
      isAllowedAffiliateDestination("https://www.jumia.com.eg/catalog/?q=iphone"),
    ).toBe(false);
    expect(isAllowedAffiliateDestination("https://btech.com/")).toBe(false);
  });
});

describe("Jumia search-engine fallback URL extraction", () => {
  it("decodes DuckDuckGo redirect links into native product URLs", () => {
    const html = `<a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(
      "https://www.jumia.com.eg/iphone-15-128gb-123.html",
    )}&amp;rut=abc">iPhone 15</a>`;

    expect(extractJumiaProductUrlsFromSearchHtml(html)).toEqual([
      "https://www.jumia.com.eg/iphone-15-128gb-123.html",
    ]);
  });

  it("decodes Bing redirect links and ignores non-product result pages", () => {
    const target = Buffer.from(
      "https://www.jumia.com.eg/iphone-15-128gb-456.html",
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const html = `
      <a href="https://www.bing.com/ck/a?!&&p=xyz&u=a1${target}&ntb=1">iPhone</a>
      <a href="https://www.jumia.com.eg/catalog/?q=iphone">Search</a>`;

    expect(extractJumiaProductUrlsFromSearchHtml(html)).toEqual([
      "https://www.jumia.com.eg/iphone-15-128gb-456.html",
    ]);
  });
});
