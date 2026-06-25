import { notFound } from "next/navigation";
import ProductDetailsPageClient from "@/components/ProductDetailsPageClient";
import { getProductDetail } from "@/lib/data/product-detail";
import { generateProductMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params;
  const detail = await getProductDetail(id);
  if (!detail) return { title: "Product Not Found" };

  return generateProductMetadata({
    name: detail.product.name,
    description: detail.product.description ?? detail.product.name,
    price: detail.comparison.lowestPrice ?? 0,
    image: detail.product.imageUrl,
    category: detail.categoryName,
    marketplace: detail.comparison.cheapestStoreName ?? "Zorino",
  });
}

export default async function ProductDetailsPage({ params }: ProductPageProps) {
  const { id } = await params;
  const detail = await getProductDetail(id);
  if (!detail) notFound();
  return <ProductDetailsPageClient detail={detail} />;
}
