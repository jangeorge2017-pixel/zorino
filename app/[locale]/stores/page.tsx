import StoresPageClient from "@/components/StoresPageClient";
import { getMockStoresForPage } from "@/lib/mock/page-data";

export default function StoresPage() {
  const stores = getMockStoresForPage();
  return <StoresPageClient stores={stores} />;
}
