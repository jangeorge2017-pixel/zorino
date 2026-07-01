import DealsPageClient from "@/components/DealsPageClient";
import { getMockDealsForPage } from "@/lib/mock/page-data";

export default function DealsPage() {
  const deals = getMockDealsForPage();
  return <DealsPageClient deals={deals} />;
}
