import { notFound } from "next/navigation";
import CategoryDetailPageClient from "@/components/CategoryDetailPageClient";
import { getMockCategoryDetail } from "@/lib/mock/page-data";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  const detail = getMockCategoryDetail(slug);
  if (!detail) notFound();
  return <CategoryDetailPageClient detail={detail} />;
}
