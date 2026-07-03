import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { triggerPhase1Imports } from "@/services/sync";

/** Run Phase 1 product imports (AliExpress, eBay, CJdropshipping). */
export async function POST(request: Request) {
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
