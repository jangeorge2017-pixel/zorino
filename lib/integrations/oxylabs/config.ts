export const OXYLABS_CREDENTIAL_KEYS = {
  USERNAME: "OXYLABS_USERNAME",
  PASSWORD: "OXYLABS_PASSWORD",
} as const;

export function getOxylabsCredentials(): {
  username: string;
  password: string;
} | null {
  const username = process.env[OXYLABS_CREDENTIAL_KEYS.USERNAME]?.trim();
  const password = process.env[OXYLABS_CREDENTIAL_KEYS.PASSWORD]?.trim();
  if (!username || !password) return null;
  return { username, password };
}

export function isOxylabsConfigured(): boolean {
  return Boolean(getOxylabsCredentials());
}
