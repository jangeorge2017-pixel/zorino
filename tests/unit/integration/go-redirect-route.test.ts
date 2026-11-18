import { describe, expect, it } from "vitest";
import { GET } from "@/app/[locale]/go/[provider]/route";

function call(provider: string, destination: string) {
  const url = `https://zorino.org/en/go/${provider}?url=${encodeURIComponent(destination)}`;
  return GET(new Request(url), {
    params: Promise.resolve({ locale: "en", provider }),
  });
}

const jumiaProduct =
  "https://www.jumia.com.eg/apple-iphone-18-pro-1tb-5g-mobile-phone-burgundy-135151552.html";

describe("/[locale]/go/[provider] compatibility redirect", () => {
  it("hands allowlisted product URLs to the canonical affiliate route", async () => {
    const response = await call("jumia", jumiaProduct);
    expect(response.status).toBe(302);

    const location = response.headers.get("location") ?? "";
    expect(location.startsWith("/api/affiliate/go?")).toBe(true);
    expect(location).toContain("store=jumia");

    const params = new URLSearchParams(location.split("?")[1]);
    expect(params.get("to")).toBe(jumiaProduct);
  });

  it("rejects unknown providers", async () => {
    const response = await call("not-a-store", jumiaProduct);
    expect(response.status).toBe(404);
  });

  it("rejects a destination that does not belong to the provider", async () => {
    const response = await call("jumia", "https://btech.com/en/p/iphone-15");
    expect(response.status).toBe(403);
  });

  it("rejects merchant homepages", async () => {
    const response = await call("jumia", "https://www.jumia.com.eg/");
    expect(response.status).toBe(403);
  });
});
