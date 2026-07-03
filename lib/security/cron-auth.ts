import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";

/** Fail closed in production when CRON_SECRET is unset. Bearer header only. */
export function authorizeCronRequest(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export function cronUnauthorizedResponse(): NextResponse {
  const secret = getCronSecret();
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
