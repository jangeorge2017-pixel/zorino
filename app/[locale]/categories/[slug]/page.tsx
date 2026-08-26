import CategoryDetailPageClient from "@/components/CategoryDetailPageClient";
import { getCategories } from "@/services/categories";
import { searchProducts } from "@/lib/search/engine";
import type { MockCategoryDetail } from "@/lib/mock/types";
import type { Category } from "@/lib/types/entities";
import { generateCategoryMetadata } from "@/lib/seo/metadata";
import { getCategorySearchKeyword, productMatchesCategory } from "@/lib/data/category-keywords";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string; locale: string }>;
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

export async function generateMetadata({ params }: CategoryDetailPageProps) {
  const { slug, locale } = await params;
  const { data: categories } = await getCategories();
  const category = categories.find((c) => c.slug === slug) ?? categoryFromSlug(slug);
  return generateCategoryMetadata(
    {
      name: category.name,
      description: `Live deals and discounts for ${category.name}.`,
      slug: category.slug,
    },
    { locale: locale === "ar" ? "ar" : "en" },
  );
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  const { data: categories } = await getCategories();
  const category = categories.find((c) => c.slug === slug) ?? categoryFromSlug(slug);

  // Use category-specific keywords instead of hardcoded electronics queries
  const keyword = getCategorySearchKeyword(slug);
  const allProducts = await searchProducts(keyword, 60).catch(() => []);

  // Filter products that actually belong to this category
  const products = allProducts.filter((item) =>
    productMatchesCategory(item.category, slug),
  );

  const displayProducts = products.length > 0 ? products : allProducts.slice(0, 24);

  const detail: MockCategoryDetail = {
    category: { ...category, productCount: displayProducts.length },
    description: `Live deals for ${category.name} across all stores.`,
    products: displayProducts,
  };

  return <CategoryDetailPageClient detail={detail} />;
}
