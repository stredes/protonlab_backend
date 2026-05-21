import { describe, expect, it } from "vitest";

import { checkRateLimit, securityHeaders, withSecurityHeaders } from "../../src/server/security";

describe("security helpers", () => {
  it("adds common security headers", async () => {
    const response = withSecurityHeaders(new Response("ok"));

    expect(response.headers.get("x-content-type-options")).toBe(securityHeaders["x-content-type-options"]);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    await expect(response.text()).resolves.toBe("ok");
  });

  it("rate limits repeated requests by key", async () => {
    const request = new Request("http://localhost/api/status");

    expect(checkRateLimit(request, { key: "test-rate-limit", limit: 1, windowMs: 60_000 })).toBeNull();
    const failure = checkRateLimit(request, { key: "test-rate-limit", limit: 1, windowMs: 60_000 });

    expect(failure?.status).toBe(429);
    await expect(failure?.json()).resolves.toMatchObject({
      success: false,
      code: "RATE_LIMITED"
    });
  });
});
