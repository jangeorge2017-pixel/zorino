import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults, getSearchResultsPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { getServerIntlPreferences } from "@/lib/international/preferences";

export const maxDuration = 60;

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
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

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { q = "", sort: sortRaw = "" } = await searchParams;
  const { locale } = await params;
  const trimmed = q.trim();
  const sort = sortRaw === "price" || sortRaw === "price_low" ? "price" : "relevance";
  // Resolve the visitor's ACTIVE currency (cookie > geo header > locale default)
  // so the strict device floor and the display seam both speak the visitor's
  // currency — US$150 vs EGP≈7500 floors, and rendered prices, never raw EGP
  // digits judged against a USD baseline.
  const { currencyCode } = await getServerIntlPreferences(locale === "ar" ? "ar" : "en");
  const filters = await getSearchFilters(await getSearchResults(trimmed, sort, currencyCode));
  const firstPage = await getSearchResultsPage(
    trimmed,
    0,
    SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
    sort,
    currencyCode,
  );

  return (
    <SearchPageClient
      initialQuery={trimmed}
      initialResults={firstPage.items}
      total={firstPage.total}
      hasMore={firstPage.hasMore}
      categories={filters.categories}
      stores={filters.stores}
      initialSortBy={sort === "price" ? "price_low" : "relevance"}
    />
  );
}
