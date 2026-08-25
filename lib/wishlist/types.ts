export type WishlistSnapshotItem = {
  id: string;
  name: string;
  imageSrc?: string;
  emoji?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  store?: string;
  storeSlug?: string;
  inStock?: boolean;
  addedAt: string;
};
