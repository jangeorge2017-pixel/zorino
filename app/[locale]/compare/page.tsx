import Navbar from "@/components/navbar";
import ComparePageClient from "@/components/ComparePageClient";
import { getComparePageProducts } from "@/lib/data/compare";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const products = await getComparePageProducts(6);
  return (
    <main className="min-h-screen">
      <Navbar />
      <ComparePageClient products={products} />
    </main>
  );
}
