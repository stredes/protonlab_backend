import { describe, expect, it } from "vitest";

import AdminPage from "../../app/admin/page";
import { GET as getAsciiStatus } from "../../app/route";

describe("HomePage", () => {
  it("renders a plain text backend status", async () => {
    const response = await getAsciiStatus();
    const text = await response.text();

    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("PROTONLAB BACKEND");
    expect(text).toContain("/api/status");
  });

  it("renders an admin workspace for the SQL assistant", async () => {
    const element = await AdminPage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });
});
