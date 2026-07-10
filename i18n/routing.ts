import { defineRouting } from "next-intl/routing";
import { locales } from "./config";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // URL is the source of truth. Cookie-based detection caused AR→EN switches
  // to bounce back to /ar when navigating to the unprefixed default locale.
  localeDetection: false,
});
