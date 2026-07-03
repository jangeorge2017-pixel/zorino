import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { runNotificationAlerts } from "@/services/notifications/alerts";

/** Cron: price-drop and trending notification alerts. */
export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const result = await runNotificationAlerts();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
