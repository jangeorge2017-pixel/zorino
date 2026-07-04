import DealsPageClient from "@/components/DealsPageClient";
import { getDealsForPage } from "@/lib/data/homepage";

export default async function DealsPage() {
  const deals = await getDealsForPage();
  return <DealsPageClient deals={deals} />;
}
