"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, TrendingUp } from "lucide-react";

type SearchBarProps = {
  defaultOpen?: boolean;
  popularSearches: string[];
};

export default function SearchBar({
  defaultOpen = false,
  popularSearches,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (defaultOpen) {
      setFocused(true);
    }
  }, [defaultOpen]);

  return (
    <div className="search-section">
      <div className={`search-wrapper ${focused ? "search-wrapper-active" : ""}`}>
        <div className="search-bar">
          <Search size={20} className="search-icon" />

          <input
            type="text"
            placeholder="Search for products, brands or categories..."
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />

          <button type="button" className="ai-search-btn">
            <Sparkles size={14} />
            AI Search
          </button>

          <button type="button" className="search-submit-btn">
            Search
          </button>
        </div>

        {focused && popularSearches.length > 0 && (
          <div className="search-dropdown">
            <p className="search-dropdown-label">Popular searches</p>
            <ul className="search-suggestions">
              {popularSearches.map((term) => (
                <li key={term}>
                  <TrendingUp size={14} />
                  {term}
                </li>
              ))}
            </ul>
            <button type="button" className="search-view-all">
              View all suggestions →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
