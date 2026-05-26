import { describe, expect, it, vi } from "vitest";

import { createUserManagementHandler } from "../../src/server/users";

describe("user management handler", () => {
  it("lets root create a user and persists the role as Firebase custom claims", async () => {
    const auth = {
      createUser: vi.fn().mockResolvedValue({
        uid: "user-123",
        email: "seller@protonlab.cl",
        displayName: "Vendedor Proton"
      }),
      setCustomUserClaims: vi.fn()
    };
    const profileStore = {
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createUserManagementHandler({
      authorizeRoot: vi.fn().mockResolvedValue({
        uid: "root-1",
        email: "root@protonlab.cl",
        role: "root"
      }),
      auth,
      profileStore
    });

    const response = await handler.create(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer root-token"
        },
        body: JSON.stringify({
          name: "Vendedor Proton",
          email: "seller@protonlab.cl",
          password: "temporal123",
          role: "vendedor",
          department: "Ventas"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(auth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "seller@protonlab.cl",
        password: "temporal123",
        displayName: "Vendedor Proton",
        disabled: false
      })
    );
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        role: "vendedor",
        department: "Ventas",
        isActive: true
      })
    );
    expect(profileStore.set).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        uid: "user-123",
        email: "seller@protonlab.cl",
        name: "Vendedor Proton",
        role: "vendedor",
        department: "Ventas",
        isActive: true
      }),
      { merge: true }
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        user: {
          id: "user-123",
          email: "seller@protonlab.cl",
          name: "Vendedor Proton",
          role: "vendedor",
          department: "Ventas",
          isActive: true
        }
      }
    });
  });

  it("rejects non-root user management requests", async () => {
    const handler = createUserManagementHandler({
      authorizeRoot: vi.fn().mockResolvedValue(null),
      auth: {
        createUser: vi.fn(),
        setCustomUserClaims: vi.fn()
      }
    });

    const response = await handler.list(
      new Request("http://localhost/api/users", {
        headers: {
          authorization: "Bearer user-token"
        }
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "FORBIDDEN"
    });
  });
});
