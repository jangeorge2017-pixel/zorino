import CategoryDetailPageClient from "@/components/CategoryDetailPageClient";
import { getCategories } from "@/services/categories";
import { searchAliExpressLive } from "@/services/aliexpress/search";
import type { MockCategoryDetail } from "@/lib/mock/types";
import type { Category } from "@/lib/types/entities";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function categoryFromSlug(slug: string): Category {
  return {
    id: slug,
    name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    slug,
    isActive: true,
    sortOrder: 0,
    productCount: 0,
  };
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  const { data: categories } = await getCategories();
  const category = categories.find((c) => c.slug === slug) ?? categoryFromSlug(slug);

  const products = await searchAliExpressLive(category.name, 24);

  const detail: MockCategoryDetail = {
    category: { ...category, productCount: products.length },
    description: `Live AliExpress deals for ${category.name}.`,
    products,
  };

  return <CategoryDetailPageClient detail={detail} />;
}
