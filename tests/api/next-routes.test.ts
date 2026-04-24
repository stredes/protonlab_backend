import { describe, expect, it } from "vitest";

import { GET as getHealth } from "../../app/api/health/route";
import { GET as getReady } from "../../app/api/ready/route";

describe("next route handlers", () => {
  it("returns health payload from app/api/health", async () => {
    const response = await getHealth(
      new Request("http://localhost/api/health", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        service: "protonlab-backend",
        status: "ok"
      }
    });
  });

  it("returns ready payload from app/api/ready", async () => {
    const response = await getReady(
      new Request("http://localhost/api/ready", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        service: "protonlab-backend",
        status: "ready",
        dependencies: {
          firestore: "up"
        }
      }
    });
  });
});
