import { describe, expect, it } from "vitest";

import { fail, ok } from "../../src/utils/responses";

describe("responses", () => {
  it("builds successful responses with request id header", async () => {
    const response = ok({ hello: "world" }, { requestId: "req-123" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-request-id")).toBe("req-123");
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        hello: "world"
      }
    });
  });

  it("builds error responses with standard shape", async () => {
    const response = fail("No autorizado", {
      status: 403,
      code: "FORBIDDEN",
      requestId: "req-456"
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("req-456");
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "No autorizado",
      code: "FORBIDDEN",
      details: {
        requestId: "req-456"
      }
    });
  });
});
