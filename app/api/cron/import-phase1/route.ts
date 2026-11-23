import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { triggerPhase1Imports } from "@/services/sync";
import { isWebSupabaseOnly } from "@/lib/sync/config";

/** Run Phase 1 product imports (AliExpress, eBay, CJdropshipping). */
export async function POST(request: Request) {
  if (isWebSupabaseOnly()) {
    return NextResponse.json({
      ok: true,
      mode: "web-supabase-only",
      skipped: "Heavy imports run in GitHub Actions; web service serves Supabase reads only.",
    });
  }

  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const { data, error } = await triggerPhase1Imports();

  if (error) {
    return NextResponse.json({ success: false, error, results: data }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    providersRun: data.length,
    results: data,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
