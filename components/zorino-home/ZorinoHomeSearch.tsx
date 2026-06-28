"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, TrendingUp } from "lucide-react";

type ZorinoHomeSearchProps = {
  popularSearches: string[];
};

export default function ZorinoHomeSearch({ popularSearches }: ZorinoHomeSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");

  const goToSearch = (term?: string) => {
    const value = (term ?? query).trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/search?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToSearch();
  };

  return (
    <div className={`zh-search${open ? " zh-search--open" : ""}`}>
      <form className="zh-search__bar" onSubmit={handleSubmit}>
        <Search size={20} className="zh-search__icon" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for products, brands or categories..."
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <button type="button" className="zh-search__ai" onClick={() => goToSearch()}>
          <Sparkles size={14} aria-hidden />
          AI Search
        </button>
        <button type="submit" className="zh-search__submit">
          Search
        </button>
      </form>

      {open && popularSearches.length > 0 ? (
        <div className="zh-search__dropdown">
          <h4>Popular searches</h4>
          <ul>
            {popularSearches.map((term) => (
              <li key={term} role="button" tabIndex={0} onMouseDown={() => goToSearch(term)}>
                <TrendingUp size={14} aria-hidden />
                {term}
              </li>
            ))}
          </ul>
          <button type="button" className="zh-search__view-all" onMouseDown={() => goToSearch()}>
            View all suggestions →
          </button>
        </div>
      ) : null}
    </div>
  );
}
