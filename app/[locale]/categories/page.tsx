import CategoriesPageClient from "@/components/CategoriesPageClient";
import { getCategoriesForPage } from "@/lib/data/homepage";

export default async function CategoriesPage() {
  const categories = await getCategoriesForPage();
  return <CategoriesPageClient categories={categories} />;
}
