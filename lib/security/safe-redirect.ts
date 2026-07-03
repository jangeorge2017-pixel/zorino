/** Allow only same-origin relative paths for post-auth redirects. */
export function safeRelativeRedirectPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.includes("\\") || next.includes("@")) return "/";
  return next;
}
