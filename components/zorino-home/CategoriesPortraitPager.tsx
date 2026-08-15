"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

const PORTRAIT_MQ = "(max-width: 767px) and (orientation: portrait)";
/** Portrait shows exactly 4 category tiles — paging swaps pages of 4. */
const PORTRAIT_PAGE_SIZE = 4;

/**
 * Portrait-only premium arrow. Tapping pages forward through the category
 * tiles (4 per page), wrapping back to the start — so the remaining
 * categories are revealed without any change to layout, sizing or spacing.
 * Hidden on every other viewport by the .zh-categories__arrow CSS.
 */
export default function CategoriesPortraitPager() {
  const t = useTranslations("home");
  const [page, setPage] = useState(0);

  const applyPaging = useCallback(() => {
    const row = document.querySelector<HTMLElement>(".zh-page .zh-categories");
    if (!row) return;
    const portrait = window.matchMedia(PORTRAIT_MQ).matches;
    const items = row.querySelectorAll<HTMLElement>(".zh-categories__item");
    if (!portrait) {
      items.forEach((item) => item.style.removeProperty("display"));
      return;
    }
    const pages = Math.max(1, Math.ceil(items.length / PORTRAIT_PAGE_SIZE));
    const p = Math.min(page, pages - 1);
    items.forEach((item, i) => {
      const show =
        i >= p * PORTRAIT_PAGE_SIZE && i < p * PORTRAIT_PAGE_SIZE + PORTRAIT_PAGE_SIZE;
      item.style.setProperty("display", show ? "flex" : "none", "important");
    });
  }, [page]);

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_MQ);
    const apply = () => applyPaging();
    apply();
    const onChange = () => {
      if (!mq.matches) setPage(0);
      apply();
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [applyPaging]);

  const onNext = useCallback(() => {
    const row = document.querySelector<HTMLElement>(".zh-page .zh-categories");
    if (!row) return;
    const count = row.querySelectorAll(".zh-categories__item").length;
    const pages = Math.max(1, Math.ceil(count / PORTRAIT_PAGE_SIZE));
    setPage((p) => (p + 1) % pages);
  }, []);

  return (
    <button
      type="button"
      className="zh-categories__arrow"
      aria-label={t("categoriesNav")}
      onClick={onNext}
    >
      <ChevronRight size={22} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
