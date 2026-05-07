import { describe, expect, it, vi } from "vitest";

import { createStatusService } from "../../src/server/status";

describe("createStatusService", () => {
  it("reports healthy vercel and frontend integration status", async () => {
    const service = createStatusService({
      env: {
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_URL: "protonlab-backend.vercel.app",
        PROTONLAB_ALLOWED_ORIGINS:
          "https://protonlab-frontend.vercel.app,https://preview.vercel.app",
        FIREBASE_PROJECT_ID: "protonlab-prod",
        FIREBASE_CLIENT_EMAIL: "firebase-adminsdk@example.com",
        FIREBASE_PRIVATE_KEY: "private-key"
      },
      firestoreCheck: async () => true,
      fetchFn: vi.fn().mockResolvedValue(
        new Response("ok", {
          status: 200
        })
      )
    });

    const status = await service.getStatus();

    expect(status.deployment.provider).toBe("vercel");
    expect(status.deployment.environment).toBe("production");
    expect(status.backend.publicUrl).toBe(
      "https://protonlab-backend.vercel.app"
    );
    expect(status.frontend.configured).toBe(true);
    expect(status.frontend.reachable).toBe(true);
    expect(status.integrations.firebaseConfigured).toBe(true);
    expect(status.integrations.firestoreReady).toBe(true);
    expect(status.summary.level).toBe("ok");
  });

  it("reports missing frontend and firebase configuration", async () => {
    const service = createStatusService({
      env: {},
      firestoreCheck: async () => false,
      fetchFn: vi.fn()
    });

    const status = await service.getStatus();

    expect(status.deployment.provider).toBe("local");
    expect(status.frontend.configured).toBe(false);
    expect(status.frontend.reachable).toBe(false);
    expect(status.integrations.firebaseConfigured).toBe(false);
    expect(status.integrations.firestoreReady).toBe(false);
    expect(status.summary.level).toBe("error");
    expect(status.summary.items).toContain(
      "Configura PROTONLAB_ALLOWED_ORIGINS con el dominio del frontend."
    );
  });
});
