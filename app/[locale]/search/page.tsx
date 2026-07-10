import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export const maxDuration = 60;

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Search",
    description: "Search products, deals, and stores across marketplaces",
    pathname: "/search",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const results = await getSearchResults(q);
  const filters = await getSearchFilters(results);

  return (
    <SearchPageClient
      initialQuery={q}
      initialResults={results}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
