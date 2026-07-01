import ComparePageClient from "@/components/ComparePageClient";
import { getMockComparePageProducts } from "@/lib/mock/page-data";

export default function ComparePage() {
  const products = getMockComparePageProducts();
  return <ComparePageClient products={products} />;
}
