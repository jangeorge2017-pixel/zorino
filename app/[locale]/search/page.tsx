import SearchPageClient from "@/components/SearchPageClient";
import { getSearchFilters, getSearchResults } from "@/lib/data/homepage";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const [results, filters] = await Promise.all([getSearchResults(q), getSearchFilters()]);

  return (
    <SearchPageClient
      initialQuery={q}
      initialResults={results}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
