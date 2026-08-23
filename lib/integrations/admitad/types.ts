export type AdmitadFeedOffer = {
  id: string;
  name: string;
  price: number;
  oldprice: number | null;
  currencyId: string;
  description: string;
  vendor: string;
  url: string;
  image: string;
  modified_time: string;
};

export type AdmitadFeedConfig = {
  name: string;
  feedUrl: string;
  slug: string;
  /** True for the primary ADMITAD_FEED_URL feed */
  isPrimary?: boolean;
  /** Admitad campaign/program ID (discovered feeds) */
  merchantId?: number;
  /** Publisher ad-space ID the program is connected to */
  websiteId?: number;
  /** Whether the program supports Admitad deeplink generation */
  canGenerateDeeplinks?: boolean;
  /** Targeted regions (empty/undefined = unrestricted) */
  geoRestrictions?: string[];
  /** Program categories */
  categories?: string[];
};
