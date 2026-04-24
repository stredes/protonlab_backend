import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders a minimal backend landing page", () => {
    const element = HomePage();

    expect(element.type).toBe("main");
    expect(element.props.children).toBeTruthy();
  });
});
