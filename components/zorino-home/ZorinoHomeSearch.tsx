"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

type ZorinoHomeSearchProps = {
  popularSearches: string[];
};

export default function ZorinoHomeSearch({ popularSearches }: ZorinoHomeSearchProps) {
  const t = useTranslations("hero");
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");

  const suggestions = popularSearches
    .map((term) => term.trim())
    .filter(Boolean)
    // Keep dropdown scannable — long product titles belong on the search page.
    .filter((term) => term.length <= 48)
    .slice(0, 8);

  const showDropdown = focused && suggestions.length > 0;

  useEffect(() => {
    if (!showDropdown) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setFocused(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showDropdown]);

  const goToSearch = (term?: string) => {
    const value = (term ?? query).trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    setFocused(false);
    router.push(`/search?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToSearch();
  };

  return (
    <div
      ref={rootRef}
      className={`zh-search${showDropdown ? " zh-search--open" : ""}`}
    >
      <form className="zh-search__bar" onSubmit={handleSubmit} role="search">
        <Search size={20} className="zh-search__icon" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          onFocus={() => setFocused(true)}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          autoComplete="off"
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
        <div
          id={listId}
          className="zh-search__dropdown"
          role="listbox"
          aria-label={t("popularSearches")}
        >
          <h4>{t("popularSearches")}</h4>
          <ul>
            {suggestions.map((term) => (
              <li
                key={term}
                role="option"
                tabIndex={0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToSearch(term);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToSearch(term);
                  }
                }}
              >
                <TrendingUp size={14} aria-hidden />
                <span className="zh-search__suggestion-text">{term}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="zh-search__view-all"
            onMouseDown={(e) => {
              e.preventDefault();
              goToSearch();
            }}
          >
            {t("viewAllSuggestions")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
