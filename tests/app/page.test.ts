import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders a backend status landing page", async () => {
    const element = await HomePage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });
});
