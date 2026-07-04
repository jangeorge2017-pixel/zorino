import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults } from "@/lib/data/homepage";
import { getMockSearchFilters } from "@/lib/mock/page-data";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;

  const results = await getSearchResults(q);
  let filters: { categories: { value: string; label: string }[]; stores: { value: string; label: string }[] };

  try {
    filters = await getSearchFilters();
    if (filters.categories.length === 0 && filters.stores.length === 0) {
      filters = getMockSearchFilters();
    }
  } catch {
    filters = getMockSearchFilters();
  }

  // Ensure AliExpress appears in store filter when live results are present.
  if (
    results.some((r) => r.storeSlug === "aliexpress") &&
    !filters.stores.some((s) => s.value === "aliexpress")
  ) {
    filters = {
      ...filters,
      stores: [{ value: "aliexpress", label: "AliExpress" }, ...filters.stores],
    };
  }

  return (
    <SearchPageClient
      initialQuery={q}
      initialResults={results}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
