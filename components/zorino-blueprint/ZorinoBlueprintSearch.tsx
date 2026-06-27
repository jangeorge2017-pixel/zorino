"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, TrendingUp } from "lucide-react";

type Props = {
  popularSearches: string[];
  defaultOpen?: boolean;
};

export default function ZorinoBlueprintSearch({
  popularSearches,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div className={`zb-search-wrap${open ? " zb-search-wrap--open" : ""}`}>
      <div className="zb-search-bar">
        <Search size={20} className="zb-search-icon" aria-hidden />
        <input
          type="text"
          placeholder="Search for products, brands or categories..."
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <button type="button" className="zb-ai-btn">
          <Sparkles size={14} aria-hidden />
          AI Search
        </button>
        <button type="button" className="zb-search-submit">
          Search
        </button>
      </div>

      {open && popularSearches.length > 0 ? (
        <div className="zb-search-dropdown">
          <h4>Popular searches</h4>
          <ul>
            {popularSearches.map((term) => (
              <li key={term}>
                <TrendingUp size={14} aria-hidden />
                {term}
              </li>
            ))}
          </ul>
          <button type="button" className="zb-search-view-all">
            View all suggestions →
          </button>
        </div>
      ) : null}
    </div>
  );
}
