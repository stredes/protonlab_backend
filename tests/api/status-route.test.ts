import { describe, expect, it } from "vitest";

import { GET as getStatus } from "../../app/api/status/route";

describe("status route", () => {
  it("returns deployment and integration status", async () => {
    const response = await getStatus(
      new Request("http://localhost/api/status", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.objectContaining({
        deployment: expect.any(Object),
        backend: expect.any(Object),
        frontend: expect.any(Object),
        integrations: expect.any(Object),
        summary: expect.any(Object)
      })
    );
  });
});
