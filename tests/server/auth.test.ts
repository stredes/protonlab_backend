import { describe, expect, it } from "vitest";
import { resolveRoleFromClaims } from "../../src/server/auth";

describe("resolveRoleFromClaims", () => {
  it("uses the explicit role claim", () => {
    expect(resolveRoleFromClaims({ role: "admin" })).toBe("admin");
  });

  it("uses namespaced role claims", () => {
    expect(
      resolveRoleFromClaims({ "https://protonlab.cl/role": "root" })
    ).toBe("root");
  });

  it("accepts roles arrays from Firebase custom claims", () => {
    expect(resolveRoleFromClaims({ roles: ["admin"] })).toBe("admin");
  });

  it("accepts boolean privileged role flags", () => {
    expect(resolveRoleFromClaims({ admin: true })).toBe("admin");
  });

  it("falls back to socio when no supported role claim exists", () => {
    expect(resolveRoleFromClaims({})).toBe("socio");
  });
});
