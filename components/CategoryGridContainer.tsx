import CategoryGrid from "@/components/CategoryGrid";
import { getHomepageCategories } from "@/lib/data/homepage";

export default async function CategoryGridContainer() {
  const categories = await getHomepageCategories();
  return <CategoryGrid categories={categories} />;
}
