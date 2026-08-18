import WishlistPageClient from "@/components/WishlistPageClient";
import { searchProducts } from "@/lib/search/engine";

const WISHLIST_QUERIES = ["laptop", "monitor", "earbuds", "smartwatch"] as const;

export default async function WishlistPage() {
  const batches = await Promise.all(
    WISHLIST_QUERIES.map((q) => searchProducts(q, 2).catch(() => [])),
  );
  const seen = new Set<string>();
  const recommendations = batches.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return <WishlistPageClient items={[]} recommendations={recommendations} />;
}
