import { notFound } from "next/navigation";
import ProductDetailsPageClient from "@/components/ProductDetailsPageClient";
import { generateProductMetadata } from "@/lib/seo/metadata";
import { getAliExpressProductDetail } from "@/services/aliexpress/search";

type ProductPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { id, locale } = await params;
  const detail = await getAliExpressProductDetail(id);
  if (!detail) return { title: "Product Not Found" };

  return generateProductMetadata(
    {
      name: detail.product.name,
      description: detail.product.description ?? detail.product.name,
      price: detail.comparison.lowestPrice ?? 0,
      image: detail.product.imageUrl,
      category: detail.categoryName,
      marketplace: detail.comparison.cheapestStoreName ?? "AliExpress",
    },
    { locale: locale as "en" | "ar", pathname: `/product/${id}` }
  );
}

export default async function ProductDetailsPage({ params }: ProductPageProps) {
  const { id } = await params;
  const detail = await getAliExpressProductDetail(id);
  if (!detail) notFound();
  return <ProductDetailsPageClient detail={detail} />;
}
