import { locales } from "@/i18n/config";

const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${locales.join("|")})(/|$)`);

/** Strip leading locale segment from a pathname. */
export function stripLocaleFromPathname(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX_PATTERN, "/");
  if (stripped === "") return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}
