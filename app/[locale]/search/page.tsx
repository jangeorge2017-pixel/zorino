import SearchPageClient from "@/components/SearchPageClient";
import { getMockSearchFilters, getMockSearchResults } from "@/lib/mock/page-data";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const results = getMockSearchResults(q);
  const filters = getMockSearchFilters();

  return (
    <SearchPageClient
      initialQuery={q}
      initialResults={results}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
