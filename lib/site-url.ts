/** Canonical public site URL for links, emails, and SEO fallbacks. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://zorino.org";
}
