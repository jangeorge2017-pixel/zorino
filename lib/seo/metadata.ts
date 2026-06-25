// SEO Metadata Utilities
// This file provides utilities for generating SEO metadata for pages

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  noIndex?: boolean;
  canonical?: string;
  locale?: string;
  alternateLocales?: string[];
  openGraph?: any;
  twitter?: any;
  robots?: any;
  alternates?: any;
}

export function generateMetadata(props: SEOProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://zorino.com";
  const {
    title = 'ZORINO - Find the Best Deals Across All Marketplaces',
    description = 'Discover amazing deals, coupons, and price comparisons across Amazon, Alibaba, AliExpress, Noon, Temu and more. Save money on every purchase with ZORINO.',
    keywords = ['deals', 'coupons', 'discounts', 'price comparison', 'Amazon', 'Alibaba', 'AliExpress', 'Noon', 'Temu', 'shopping', 'save money'],
    image = '/og-image.png',
    url = siteUrl,
    noIndex = false,
    canonical,
    locale = 'en',
    alternateLocales = ['ar'],
  } = props;

  const fullTitle = `${title} | ZORINO`;
  const fullUrl = canonical || url;

  return {
    metadataBase: new URL(siteUrl),
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: 'ZORINO' }],
    openGraph: {
      type: 'website',
      locale,
      url: fullUrl,
      title: fullTitle,
      description,
      siteName: 'ZORINO',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
      creator: '@zorino',
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
      },
    },
    alternates: {
      canonical: fullUrl,
      languages: alternateLocales.reduce((acc, altLocale) => {
        acc[altLocale] = `${fullUrl}/${altLocale}`;
        return acc;
      }, {} as Record<string, string>),
    },
  } as any;
}

export function generateProductMetadata(product: {
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  marketplace: string;
}) {
  const title = `${product.name} - ${product.marketplace}`;
  const description = `${product.description} Price: $${product.price}. Available at ${product.marketplace}.`;
  const keywords = [
    product.name,
    product.category,
    product.marketplace,
    'price comparison',
    'deals',
    'discount',
  ];

  return generateMetadata({
    title,
    description,
    keywords,
    image: product.image,
    openGraph: {
      type: 'product',
      product: {
        price: product.price,
        currency: 'USD',
        availability: 'in stock',
        category: product.category,
      },
    },
  });
}

export function generateCategoryMetadata(category: {
  name: string;
  description: string;
  slug: string;
}) {
  const title = `${category.name} Deals & Discounts`;
  const description = category.description;
  const keywords = [
    category.name,
    'deals',
    'discounts',
    'coupons',
    'price comparison',
  ];

  return generateMetadata({
    title,
    description,
    keywords,
  });
}

export function generateBlogPostMetadata(post: {
  title: string;
  excerpt: string;
  image: string;
  author: string;
  publishedAt: string;
}) {
  const title = post.title;
  const description = post.excerpt;
  const keywords = [
    ...post.title.split(' '),
    'shopping tips',
    'deals',
    'money saving',
  ];

  return generateMetadata({
    title,
    description,
    keywords,
    image: post.image,
    openGraph: {
      type: 'article',
      article: {
        publishedTime: post.publishedAt,
        authors: [post.author],
      },
    },
  });
}
