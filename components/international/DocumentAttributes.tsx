"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { languages } from "@/lib/international/config";

type DocumentAttributesProps = {
  locale: Locale;
};

/** Syncs html lang and dir with the active locale without moving the root layout. */
export default function DocumentAttributes({ locale }: DocumentAttributesProps) {
  useEffect(() => {
    const config = languages[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = config.dir;
  }, [locale]);

  return null;
}
