"use client";

import type { ProductEngagementEventType } from "@/lib/types/entities";

let sessionId: string | null = null;
let sessionFallbackCounter = 0;

/** Cryptographically random session suffix (16 random bytes, hex-encoded). */
function randomSessionSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Legacy fallback for runtimes without Web Crypto: a monotonic counter keeps
  // the id unique without relying on a weak non-cryptographic RNG.
  sessionFallbackCounter += 1;
  return `legacy_${Date.now()}_${sessionFallbackCounter}`;
}

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "server";
  const stored = window.sessionStorage.getItem("zorino_session");
  if (stored) {
    sessionId = stored;
    return stored;
  }
  sessionId = `s_${Date.now()}_${randomSessionSuffix()}`;
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
