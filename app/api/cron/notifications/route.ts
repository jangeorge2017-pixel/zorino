import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { runNotificationAlerts } from "@/services/notifications/alerts";

function authorize(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  return authHeader === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

/** Cron: price-drop and trending notification alerts. */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runNotificationAlerts();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
