"use client";

import { useState } from "react";
import { Search, Sparkles, TrendingUp } from "lucide-react";
import { popularSearches } from "@/data/home";

export default function SearchBar() {
  const [focused, setFocused] = useState(false);

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

        {focused && (
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
