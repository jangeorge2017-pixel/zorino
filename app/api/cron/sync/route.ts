import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { executeScheduledSync } from "@/services/sync";

/**
 * Cron endpoint for automatic product/price refresh.
 * Protect with CRON_SECRET header or query param.
 *
 * Vercel cron example (vercel.json):
 * { "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }] }
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await executeScheduledSync();

  if (error) {
    return NextResponse.json({ success: false, error, results: data }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    jobsRun: data.length,
    results: data,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
