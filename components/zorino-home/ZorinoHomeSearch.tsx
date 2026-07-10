"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

type ZorinoHomeSearchProps = {
  popularSearches: string[];
};

export default function ZorinoHomeSearch({ popularSearches }: ZorinoHomeSearchProps) {
  const t = useTranslations("hero");
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");

  const showDropdown =
    (focused || query.trim().length > 0) && popularSearches.length > 0;

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
    <div className={`zh-search${showDropdown ? " zh-search--open" : ""}`}>
      <form className="zh-search__bar" onSubmit={handleSubmit}>
        <Search size={20} className="zh-search__icon" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        <button type="button" className="zh-search__ai" onClick={() => goToSearch()}>
          <Sparkles size={14} aria-hidden />
          {t("aiSearch")}
        </button>
        <button type="submit" className="zh-search__submit">
          {t("searchButton")}
        </button>
      </form>

      {showDropdown ? (
        <div className="zh-search__dropdown">
          <h4>{t("popularSearches")}</h4>
          <ul>
            {popularSearches.map((term) => (
              <li key={term} role="button" tabIndex={0} onMouseDown={() => goToSearch(term)}>
                <TrendingUp size={14} aria-hidden />
                {term}
              </li>
            ))}
          </ul>
          <button type="button" className="zh-search__view-all" onMouseDown={() => goToSearch()}>
            {t("viewAllSuggestions")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
