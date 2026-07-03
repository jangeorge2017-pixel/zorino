import { NextResponse } from "next/server";
import { trackProductEvent } from "@/services/trending";
import { isSupportedCountry } from "@/lib/international/config";
import { trackingRateLimiter, enforceRateLimit } from "@/lib/security/api-rate-limit";
import { clampString, isProductId } from "@/lib/security/input";
import type { ProductEngagementEventType } from "@/lib/types/entities";

const VALID_EVENTS: ProductEngagementEventType[] = ["view", "click", "favorite", "purchase"];

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, trackingRateLimiter);
  if (rateLimited) return rateLimited;

  let body: {
    productId?: string;
    eventType?: ProductEngagementEventType;
    countryCode?: string;
    sessionId?: string;
    source?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.productId || !body.eventType || !VALID_EVENTS.includes(body.eventType)) {
    return NextResponse.json({ error: "productId and valid eventType required" }, { status: 400 });
  }

  if (!isProductId(body.productId)) {
    return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
  }

  const countryCode = clampString(body.countryCode, 8) ?? "US";
  if (!isSupportedCountry(countryCode)) {
    return NextResponse.json({ error: "Invalid countryCode" }, { status: 400 });
  }

  const { data, error } = await trackProductEvent({
    productId: body.productId,
    eventType: body.eventType,
    countryCode,
    sessionId: clampString(body.sessionId, 128),
    source: clampString(body.source, 64) ?? "homepage",
  });

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
