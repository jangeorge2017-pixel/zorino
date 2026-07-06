/**
 * Offline test for eBay challenge response hash (no network).
 */
import { createHash } from "node:crypto";

const challengeCode = "test-challenge-12345";
const verificationToken = "zorino-ebay-marketplace-account-deletion-v1";
const endpointUrl = "https://www.zorino.org/api/ebay/notifications";

const expected = createHash("sha256")
  .update(challengeCode, "utf8")
  .update(verificationToken, "utf8")
  .update(endpointUrl, "utf8")
  .digest("hex");

const { buildEbayChallengeResponse } = await import(
  "../lib/integrations/ebay/account-deletion.ts"
);

const actual = buildEbayChallengeResponse(challengeCode, verificationToken, endpointUrl);
console.log("match:", expected === actual);
if (expected !== actual) {
  console.error("expected", expected);
  console.error("actual", actual);
  process.exit(1);
}
console.log("eBay challenge hash test passed");
