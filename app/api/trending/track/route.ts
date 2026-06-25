import { NextResponse } from "next/server";
import { trackProductEvent } from "@/services/trending";
import type { ProductEngagementEventType } from "@/lib/types/entities";

const VALID_EVENTS: ProductEngagementEventType[] = ["view", "click", "favorite", "purchase"];

export async function POST(request: Request) {
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

  const { data, error } = await trackProductEvent({
    productId: body.productId,
    eventType: body.eventType,
    countryCode: body.countryCode ?? "US",
    sessionId: body.sessionId,
    source: body.source ?? "homepage",
  });

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
