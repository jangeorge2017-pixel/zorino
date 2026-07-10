"use client";

import { useLayoutEffect } from "react";
import type { Locale } from "@/i18n/config";
import { languages } from "@/lib/international/config";

type DocumentAttributesProps = {
  locale: Locale;
};

/** Syncs html lang and dir with the active locale (RTL for Arabic). */
export default function DocumentAttributes({ locale }: DocumentAttributesProps) {
  useLayoutEffect(() => {
    const config = languages[locale] ?? languages.en;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = config.dir;
    root.dataset.locale = locale;
  }, [locale]);

  return null;
}
