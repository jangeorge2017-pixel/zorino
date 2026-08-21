/**
 * Admitad Publisher API OAuth 2.0 authentication.
 *
 * Uses client-credentials grant via POST body params (Admitad requires
 * client_id + client_secret in the request body, not Basic auth header).
 * Token is cached in memory and auto-refreshed before expiry.
 *
 * Credentials are read from environment variables (Vercel Production
 * is the authoritative source) with DB integration_settings fallback
 * via getIntegrationCredential().
 */

import { getIntegrationCredential } from "@/lib/integration/credentials";

const TOKEN_URL = "https://api.admitad.com/token/";

const REQUIRED_SCOPES = [
  "advcampaigns",
  "advcampaigns_for_website",
  "websites",
  "deeplink_generator",
].join(" ");

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = getIntegrationCredential("ADMITAD_CLIENT_ID");
  const clientSecret = getIntegrationCredential("ADMITAD_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Obtain a fresh access_token via client-credentials grant.
 * Admitad expects client_id + client_secret as POST body params.
 */
export async function obtainAccessToken(): Promise<string> {
  const creds = getCredentials();
  if (!creds) throw new Error("ADMITAD_CLIENT_ID / ADMITAD_CLIENT_SECRET not set");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: REQUIRED_SCOPES,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Admitad token request failed: HTTP ${resp.status} — ${text}`);
  }

  const data: TokenResponse = await resp.json();

  // Cache with 60s safety margin before actual expiry
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  cachedToken = { accessToken: data.access_token, expiresAt };

  console.log(
    `[admitad-auth] obtained access_token, expires in ${data.expires_in}s, scope: ${data.scope}`,
  );
  return data.access_token;
}

/**
 * Get a valid access_token, using the cache if still fresh.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  return obtainAccessToken();
}

/**
 * Invalidate cached token (call on 401 responses).
 */
export function invalidateToken(): void {
  cachedToken = null;
}
