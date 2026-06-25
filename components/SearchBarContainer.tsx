import SearchBar from "@/components/SearchBar";
import { getPopularSearches } from "@/lib/data/homepage";

type SearchBarContainerProps = {
  defaultOpen?: boolean;
};

export default async function SearchBarContainer({
  defaultOpen = false,
}: SearchBarContainerProps) {
  const popularSearches = await getPopularSearches();
  return <SearchBar defaultOpen={defaultOpen} popularSearches={popularSearches} />;
}
