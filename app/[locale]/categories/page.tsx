import CategoriesPageClient from "@/components/CategoriesPageClient";
import { getCategoriesForPage } from "@/lib/data/homepage";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategoriesForPage();
  return <CategoriesPageClient categories={categories} />;
}
