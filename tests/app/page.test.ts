import { describe, expect, it } from "vitest";

import AdminPage from "../../app/admin/page";
import { GET as getStatusPage } from "../../app/route";

describe("HomePage", () => {
  it("renders a backend status landing page", async () => {
    const response = await getStatusPage();
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Protonlab Backend");
    expect(html).toContain("Panel operativo");
  });

  it("renders an admin workspace for the SQL assistant", async () => {
    const element = await AdminPage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });
});
