/** Canonical public site URL for links, emails, and SEO fallbacks. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://zorino.org";
}

const CONTACT_DOMAIN =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL_DOMAIN?.replace(/^@/, "") ?? "zorino.org";

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
