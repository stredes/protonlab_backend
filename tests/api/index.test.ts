import { describe, expect, it } from "vitest";

import { createApp } from "../../api/index.js";

describe("createApp", () => {
  it("returns health payload for GET /api/health", async () => {
    const app = createApp({
      firestoreHealthCheck: async () => true
    });

    const response = await app(
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

  it("returns ready payload for GET /api/ready when dependencies are ready", async () => {
    const app = createApp({
      firestoreHealthCheck: async () => true
    });

    const response = await app(
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

  it("returns not found for unknown route", async () => {
    const app = createApp({
      firestoreHealthCheck: async () => true
    });

    const response = await app(
      new Request("http://localhost/api/missing", {
        method: "GET"
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "NOT_FOUND"
    });
  });
});
