import { describe, expect, it } from "vitest";

import { requireAuth, requireRole } from "../../src/middleware/auth.js";
import type { Role } from "../../src/models/user.js";

describe("auth middleware", () => {
  it("rejects requests without bearer token", async () => {
    const auth = requireAuth({
      verifyToken: async () => {
        throw new Error("should not be called");
      }
    });

    const result = await auth(new Request("http://localhost/api/private"));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth failure");
    }
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toMatchObject({
      success: false,
      code: "TOKEN_MISSING"
    });
  });

  it("returns authenticated user when token is valid", async () => {
    const auth = requireAuth({
      verifyToken: async () => ({
        uid: "user-1",
        email: "user@example.com",
        role: "admin"
      })
    });

    const result = await auth(
      new Request("http://localhost/api/private", {
        headers: {
          Authorization: "Bearer valid-token"
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected auth success");
    }
    expect(result.context.user.uid).toBe("user-1");
    expect(result.context.user.role).toBe("admin");
  });

  it("rejects authenticated users without required role", async () => {
    const guard = requireRole(["admin", "root"] satisfies Role[]);

    const result = guard({
      request: new Request("http://localhost/api/admin"),
      requestId: "req-789",
      user: {
        uid: "user-2",
        email: "sales@example.com",
        role: "vendedor"
      }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected role failure");
    }
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toMatchObject({
      success: false,
      code: "FORBIDDEN"
    });
  });
});
