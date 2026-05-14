import { describe, expect, it } from "vitest";

import AdminPage from "../../app/admin/page";
import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders a backend status landing page", async () => {
    const element = await HomePage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });

  it("renders an admin workspace for the SQL assistant", async () => {
    const element = await AdminPage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });
});
