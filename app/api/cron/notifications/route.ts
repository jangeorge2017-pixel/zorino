import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { runNotificationAlerts } from "@/services/notifications/alerts";
import { isWebSupabaseOnly } from "@/lib/sync/config";

/** Cron: price-drop and trending notification alerts. */
export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  if (isWebSupabaseOnly()) {
    return NextResponse.json({ skipped: "handled by GitHub Actions" });
  }

  const result = await runNotificationAlerts();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
