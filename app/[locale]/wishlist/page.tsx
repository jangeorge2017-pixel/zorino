import WishlistPageClient from "@/components/WishlistPageClient";
import { getMockWishlistItems } from "@/lib/mock/page-data";

export default function WishlistPage() {
  const items = getMockWishlistItems();
  return <WishlistPageClient items={items} />;
}
