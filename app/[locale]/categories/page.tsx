import CategoriesPageClient from "@/components/CategoriesPageClient";
import { getMockCategoriesForPage } from "@/lib/mock/page-data";

export default function CategoriesPage() {
  const categories = getMockCategoriesForPage();
  return <CategoriesPageClient categories={categories} />;
}
