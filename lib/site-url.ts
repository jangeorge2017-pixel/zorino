/**
 * Canonical public site URL for links, emails, and SEO fallbacks.
 *
 * An env var that is present but empty must fall back to the default, not to
 * an empty string: `??` only catches null/undefined, so `NEXT_PUBLIC_SITE_URL=""`
 * used to yield `""` and `new URL("")` threw during `next build` (this broke
 * the Docker build, where the variable was injected as an empty build arg).
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "https://zorino.org";
}

const CONTACT_DOMAIN =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL_DOMAIN?.trim().replace(/^@/, "") || "zorino.org";

export type ContactEmailRole =
  | "support"
  | "info"
  | "privacy"
  | "legal"
  | "partnerships"
  | "notifications"
  | "admin";

/** Public-facing contact addresses on the production domain. */
export function getContactEmail(role: ContactEmailRole = "support"): string {
  return `${role}@${CONTACT_DOMAIN}`;
}
