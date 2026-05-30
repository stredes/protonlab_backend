import { describe, expect, it } from "vitest";

import { GET as getHealth, OPTIONS as optionsHealth } from "../../app/api/health/route";
import { GET as getReady, OPTIONS as optionsReady } from "../../app/api/ready/route";

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

  it("returns CORS headers for health and ready preflight requests from frontend previews", async () => {
    const request = new Request("http://localhost/api/health", {
      method: "OPTIONS",
      headers: {
        origin: "https://front-protonlab-kc93ljtv4-gianlucassanmartin-gmailcoms-projects.vercel.app",
        "access-control-request-method": "GET"
      }
    });

    const healthResponse = await optionsHealth(request);
    const readyResponse = await optionsReady(request);

    expect(healthResponse.status).toBe(204);
    expect(readyResponse.status).toBe(204);
    expect(healthResponse.headers.get("access-control-allow-origin")).toBe(
      "https://front-protonlab-kc93ljtv4-gianlucassanmartin-gmailcoms-projects.vercel.app"
    );
    expect(readyResponse.headers.get("access-control-allow-origin")).toBe(
      "https://front-protonlab-kc93ljtv4-gianlucassanmartin-gmailcoms-projects.vercel.app"
    );
  });
});
