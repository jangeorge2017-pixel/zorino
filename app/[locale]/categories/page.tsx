import CategoriesPageClient from "@/components/CategoriesPageClient";
import { getCategoriesForPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Categories",
    description: "Browse products by category",
    pathname: "/categories",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function CategoriesPage() {
  const categories = await getCategoriesForPage();
  return <CategoriesPageClient categories={categories} />;
}
