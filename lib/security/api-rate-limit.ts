import { NextResponse } from "next/server";
import { RateLimiter } from "@/lib/security/security";

export const publicApiRateLimiter = new RateLimiter(120, 60_000);
export const trackingRateLimiter = new RateLimiter(60, 60_000);
export const affiliateRateLimiter = new RateLimiter(90, 60_000);

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function enforceRateLimit(
  request: Request,
  limiter: RateLimiter,
): NextResponse | null {
  if (!limiter.isAllowed(getClientIp(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
