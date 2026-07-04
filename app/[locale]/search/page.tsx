import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults } from "@/lib/data/homepage";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

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
