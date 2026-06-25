import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { triggerPhase1Imports } from "@/services/sync";

function authorize(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return authHeader === `Bearer ${secret}` || querySecret === secret;
}

/** Run Phase 1 product imports (AliExpress, eBay, CJdropshipping). */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
