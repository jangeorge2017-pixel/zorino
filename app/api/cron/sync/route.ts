import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeScheduledSync } from "@/services/sync";

/**
 * Cron endpoint for automatic product/price refresh.
 * Protect with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "true" || request.headers.get("x-vercel-cron") === "1";

  const { data, error } = await executeScheduledSync();

  if (error) {
    return NextResponse.json({ success: false, error, results: data }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    jobsRun: data.length,
    results: data,
    force,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
