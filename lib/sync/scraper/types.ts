export type ScrapedListing = {
  externalId: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  productUrl: string;
  category: string;
  originalPrice?: number;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
};

export type ScraperStoreConfig = {
  id: string;
  name: string;
  origin: string;
  host: string;
  locale: string;
  currency: string;
  seeds: readonly string[];
  searchUrl: (query: string, page: number) => string;
};
