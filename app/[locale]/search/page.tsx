import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults, getSearchResultsPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

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
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const trimmed = q.trim();
  const filters = await getSearchFilters(await getSearchResults(trimmed));
  const firstPage = await getSearchResultsPage(
    trimmed,
    0,
    SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
  );

  return (
    <SearchPageClient
      initialQuery={trimmed}
      initialResults={firstPage.items}
      total={firstPage.total}
      hasMore={firstPage.hasMore}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
