/**
 * Amazon Creators API OAuth 2.0 client-credentials authentication.
 *
 * Token endpoint for NA (version 3.1): https://api.amazon.com/auth/o2/token
 * EU (3.2): https://api.amazon.co.uk/auth/o2/token
 * FE (3.3): https://api.amazon.co.jp/auth/o2/token
 *
 * @see https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl
 */

const TOKEN_URL_NA = "https://api.amazon.com/auth/o2/token";
const TOKEN_URL_EU = "https://api.amazon.co.uk/auth/o2/token";
const TOKEN_URL_FE = "https://api.amazon.co.jp/auth/o2/token";

function tokenEndpointForVersion(version: string): string {
  if (version.startsWith("3.2")) return TOKEN_URL_EU;
  if (version.startsWith("3.3")) return TOKEN_URL_FE;
  return TOKEN_URL_NA;
}

export type AmazonOAuthToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: AmazonOAuthToken | null = null;

/**
 * Obtain (or return cached) OAuth 2.0 access token for Creators API.
 * Tokens are valid for 3600 seconds; we refresh 60 seconds early.
 */
export async function getCreatorsAccessToken(input: {
  clientId: string;
  clientSecret: string;
  version: string;
}): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const url = tokenEndpointForVersion(input.version);
  const body = JSON.stringify({
    grant_type: "client_credentials",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    scope: "creatorsapi::default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Amazon OAuth token ${res.status}: ${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    accessToken: parsed.access_token,
    expiresAt: now + parsed.expires_in * 1000,
  };

  return cachedToken.accessToken;
}
