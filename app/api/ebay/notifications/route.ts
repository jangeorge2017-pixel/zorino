import { NextResponse } from "next/server";
import {
  buildEbayChallengeResponse,
  getEbayNotificationEndpointUrl,
  getEbayVerificationToken,
  handleEbayAccountDeletionNotification,
  type EbayAccountDeletionNotification,
} from "@/lib/integrations/ebay/account-deletion";

export const dynamic = "force-dynamic";

/**
 * eBay Marketplace Account Deletion / Closure Notifications
 * @see https://developer.ebay.com/marketplace-account-deletion
 *
 * GET  — verification challenge (challenge_code query param)
 * POST — account deletion notifications (acknowledge with 204 No Content)
 */
export async function GET(request: Request) {
  const verificationToken = getEbayVerificationToken();
  if (!verificationToken) {
    return NextResponse.json(
      {
        error:
          "EBAY_VERIFICATION_TOKEN is not configured (32–80 chars, alphanumeric, _, -)",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const challengeCode = url.searchParams.get("challenge_code")?.trim();
  if (!challengeCode) {
    return NextResponse.json({ error: "Missing challenge_code query parameter" }, { status: 400 });
  }

  const endpointUrl = getEbayNotificationEndpointUrl(request.url);
  const challengeResponse = buildEbayChallengeResponse(
    challengeCode,
    verificationToken,
    endpointUrl
  );

  return Response.json(
    { challengeResponse },
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }
  );
}

export async function POST(request: Request) {
  let payload: EbayAccountDeletionNotification;
  try {
    payload = (await request.json()) as EbayAccountDeletionNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = payload.metadata?.topic;
  if (topic && topic !== "MARKETPLACE_ACCOUNT_DELETION") {
    return NextResponse.json({ error: "Unsupported notification topic" }, { status: 400 });
  }

  handleEbayAccountDeletionNotification(payload);

  return new NextResponse(null, { status: 204 });
}
