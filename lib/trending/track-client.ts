"use client";

import type { ProductEngagementEventType } from "@/lib/types/entities";

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "server";
  sessionId =
    window.sessionStorage.getItem("zorino_session") ??
    `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem("zorino_session", sessionId);
  return sessionId;
}

export async function trackProductInteraction(input: {
  productId: string;
  eventType: ProductEngagementEventType;
  countryCode?: string;
  source?: string;
}): Promise<void> {
  try {
    await fetch("/api/trending/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        sessionId: getSessionId(),
      }),
      keepalive: input.eventType === "view",
    });
  } catch {
    // Non-blocking analytics
  }
}
