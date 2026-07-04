import WishlistPageClient from "@/components/WishlistPageClient";
import { browseAliExpressLive } from "@/services/aliexpress/search";

export default async function WishlistPage() {
  const recommendations = await browseAliExpressLive(4);
  return <WishlistPageClient items={[]} recommendations={recommendations} />;
}
