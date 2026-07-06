import { createHash } from "node:crypto";

/** Allowed: alphanumeric, underscore, hyphen; length 32–80 per eBay spec. */
const TOKEN_MIN_LEN = 32;
const TOKEN_MAX_LEN = 80;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export type EbayAccountDeletionNotification = {
  metadata?: {
    topic?: string;
    schemaVersion?: string;
    deprecated?: boolean;
  };
  notification?: {
    notificationId?: string;
    eventDate?: string;
    publishDate?: string;
    publishAttemptCount?: number;
    data?: {
      username?: string;
      userId?: string;
      eiasToken?: string;
    };
  };
};

export function getEbayVerificationToken(): string | null {
  const token = process.env.EBAY_VERIFICATION_TOKEN?.trim();
  if (!token) return null;
  if (token.length < TOKEN_MIN_LEN || token.length > TOKEN_MAX_LEN) return null;
  if (!TOKEN_PATTERN.test(token)) return null;
  return token;
}

/**
 * Public HTTPS URL registered in the eBay Developer Portal.
 * Must match exactly when computing the challenge response hash.
 */
export function getEbayNotificationEndpointUrl(): string {
  const explicit = process.env.EBAY_NOTIFICATION_ENDPOINT_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return `${site}/api/ebay/notifications`;

  return "https://www.zorino.org/api/ebay/notifications";
}

/**
 * eBay marketplace account deletion challenge response.
 * SHA-256 hex of: challengeCode + verificationToken + endpointUrl
 * @see https://developer.ebay.com/marketplace-account-deletion
 */
export function buildEbayChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string
): string {
  return createHash("sha256")
    .update(challengeCode, "utf8")
    .update(verificationToken, "utf8")
    .update(endpointUrl, "utf8")
    .digest("hex");
}

export function isValidEbayVerificationToken(token: string): boolean {
  return (
    token.length >= TOKEN_MIN_LEN &&
    token.length <= TOKEN_MAX_LEN &&
    TOKEN_PATTERN.test(token)
  );
}

/** Process account deletion notification — ZORINO stores no persistent eBay user PII. */
export function handleEbayAccountDeletionNotification(
  payload: EbayAccountDeletionNotification
): { acknowledged: true; notificationId?: string; userId?: string } {
  const notificationId = payload.notification?.notificationId;
  const userId = payload.notification?.data?.userId;

  if (process.env.NODE_ENV !== "production") {
    console.info("[ebay-account-deletion]", {
      notificationId,
      userId,
      topic: payload.metadata?.topic,
    });
  }

  return { acknowledged: true, notificationId, userId };
}
