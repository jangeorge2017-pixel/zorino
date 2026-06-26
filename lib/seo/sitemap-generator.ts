// Sitemap Generator
// This file generates XML sitemaps for the ZORINO platform

import { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const currentDate = new Date();

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/deals`,
      lastModified: currentDate,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/coupons`,
      lastModified: currentDate,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/stores`,
      lastModified: currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
  ];

  // Add locale-specific pages
  const locales = ["en", "ar"];
  const localePages: MetadataRoute.Sitemap = [];

  locales.forEach((locale) => {
    staticPages.forEach((page) => {
      if (page.url === baseUrl) return; // Skip root for locales
      localePages.push({
        url: `${baseUrl}/${locale}${page.url.replace(baseUrl, "")}`,
        lastModified: page.lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority * 0.9,
      });
    });
  });

  return [...staticPages, ...localePages];
}

// Dynamic sitemap for products (would be generated from database)
export async function generateProductSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const products = [
    { id: "1", lastModified: new Date() },
    { id: "2", lastModified: new Date() },
  ];

  return products.map((product) => ({
    url: `${baseUrl}/product/${product.id}`,
    lastModified: product.lastModified,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));
}

// Dynamic sitemap for categories (would be generated from database)
export async function generateCategorySitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const categories = [
    { slug: "electronics", lastModified: new Date() },
    { slug: "fashion", lastModified: new Date() },
  ];

  return categories.map((category) => ({
    url: `${baseUrl}/category/${category.slug}`,
    lastModified: category.lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

// Dynamic sitemap for stores (would be generated from database)
export async function generateStoreSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const stores = [
    { slug: "amazon", lastModified: new Date() },
    { slug: "aliexpress", lastModified: new Date() },
  ];

  return stores.map((store) => ({
    url: `${baseUrl}/store/${store.slug}`,
    lastModified: store.lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}
