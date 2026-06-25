import StoresPageClient from "@/components/StoresPageClient";
import { getStoresForPage } from "@/lib/data/homepage";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await getStoresForPage();
  return <StoresPageClient stores={stores} />;
}
