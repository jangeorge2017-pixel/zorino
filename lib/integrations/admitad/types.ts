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
};
