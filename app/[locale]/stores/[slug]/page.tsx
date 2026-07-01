import { notFound } from "next/navigation";
import StoreDetailPageClient from "@/components/StoreDetailPageClient";
import { getMockStoreDetail } from "@/lib/mock/page-data";

type StoreDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { slug } = await params;
  const detail = getMockStoreDetail(slug);
  if (!detail) notFound();
  return <StoreDetailPageClient detail={detail} />;
}
