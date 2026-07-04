/** Structured AliExpress API debug logging (server-only). Never logs app_secret. */

const PREFIX = "[aliexpress-api]";

export function logAliExpress(message: string, details?: unknown): void {
  if (details === undefined) {
    console.error(`${PREFIX} ${message}`);
    return;
  }
  try {
    console.error(`${PREFIX} ${message}`, JSON.stringify(details, null, 2));
  } catch {
    console.error(`${PREFIX} ${message}`, details);
  }
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(empty)";
  if (value.length <= 6) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

export function redactRequestForLog(params: Record<string, string>): Record<string, string> {
  // Full request params are logged; secret is never part of the request body.
  return { ...params };
}
