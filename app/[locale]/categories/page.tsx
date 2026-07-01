import CategoriesPageClient from "@/components/CategoriesPageClient";
import { getMockCategoriesForPage } from "@/lib/mock/page-data";
import { getServerIntlPreferences } from "@/lib/international/preferences";
import type { Locale } from "@/i18n/config";

type CategoriesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { locale } = await params;
  const prefs = await getServerIntlPreferences(locale as Locale);
  const categories = getMockCategoriesForPage(prefs.countryCode);
  return <CategoriesPageClient categories={categories} />;
}
