import { getSiteUrl } from "@/lib/site-url";
import { locales, type Locale } from "@/i18n/config";
import { buildHreflangAlternates, buildLocalizedUrl, openGraphLocale } from "@/lib/international/urls";

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  pathname?: string;
  noIndex?: boolean;
  canonical?: string;
  locale?: Locale;
  openGraph?: Record<string, unknown>;
  twitter?: Record<string, unknown>;
  robots?: Record<string, unknown>;
}

export function generateMetadata(props: SEOProps) {
  const siteUrl = getSiteUrl();
  const {
    title = "ZORINO - Find the Best Deals Across All Marketplaces",
    description = "Discover amazing deals, coupons, and price comparisons across Amazon, Alibaba, AliExpress, Noon, Temu and more. Save money on every purchase with ZORINO.",
    keywords = [
      "deals",
      "coupons",
      "discounts",
      "price comparison",
      "Amazon",
      "Alibaba",
      "AliExpress",
      "Noon",
      "Temu",
      "shopping",
      "save money",
    ],
    image = "/og-image.png",
    pathname = "/",
    noIndex = false,
    canonical,
    locale = "en",
  } = props;

  const fullTitle = title.includes("ZORINO") ? title : `${title} | ZORINO`;
  const canonicalUrl =
    canonical ?? buildLocalizedUrl(pathname, locale, siteUrl);
  const hreflang = buildHreflangAlternates(pathname, siteUrl);
  const ogLocale = openGraphLocale(locale);
  const alternateOgLocales = locales
    .filter((l) => l !== locale)
    .map(openGraphLocale);

  return {
    metadataBase: new URL(siteUrl),
    title: fullTitle,
    description,
    keywords: keywords.join(", "),
    authors: [{ name: "ZORINO" }],
    openGraph: {
      type: "website",
      locale: ogLocale,
      alternateLocale: alternateOgLocales,
      url: canonicalUrl,
      title: fullTitle,
      description,
      siteName: "ZORINO",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(props.openGraph ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: "@zorino",
      ...(props.twitter ?? {}),
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
      },
      ...(props.robots ?? {}),
    },
    alternates: {
      canonical: canonicalUrl,
      languages: hreflang,
    },
  };
}

export function generateProductMetadata(
  product: {
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    marketplace: string;
    currency?: string;
  },
  options?: { locale?: Locale; pathname?: string }
) {
  const currency = product.currency ?? "USD";
  const title = `${product.name} - ${product.marketplace}`;
  const description = `${product.description} Price: ${currency} ${product.price}. Available at ${product.marketplace}.`;

  return generateMetadata({
    title,
    description,
    keywords: [product.name, product.category, product.marketplace, "price comparison", "deals"],
    image: product.image,
    locale: options?.locale ?? "en",
    pathname: options?.pathname ?? `/product/${product.name}`,
    openGraph: {
      type: "website",
    },
  });
}

export function generateCategoryMetadata(
  category: { name: string; description: string; slug: string },
  options?: { locale?: Locale }
) {
  return generateMetadata({
    title: `${category.name} Deals & Discounts`,
    description: category.description,
    keywords: [category.name, "deals", "discounts", "coupons", "price comparison"],
    locale: options?.locale ?? "en",
    pathname: `/categories/${category.slug}`,
  });
}

export function generateBlogPostMetadata(
  post: {
    title: string;
    excerpt: string;
    image: string;
    author: string;
    publishedAt: string;
    slug?: string;
  },
  options?: { locale?: Locale }
) {
  return generateMetadata({
    title: post.title,
    description: post.excerpt,
    keywords: [...post.title.split(" "), "shopping tips", "deals", "money saving"],
    image: post.image,
    locale: options?.locale ?? "en",
    pathname: `/blog/${post.slug ?? "post"}`,
    openGraph: {
      type: "article",
      article: {
        publishedTime: post.publishedAt,
        authors: [post.author],
      },
    },
  });
}
