import { describe, expect, it } from "vitest";

import { getCatalogDataset } from "../../src/server/catalog";

describe("catalog dataset selection", () => {
  it("uses the fake dataset when PROTONLAB_USE_FAKE_CATALOG is enabled", () => {
    const dataset = getCatalogDataset(
      new Request("http://localhost/api/products"),
      {
        PROTONLAB_USE_FAKE_CATALOG: "true"
      }
    );

    expect(dataset.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^fake-/)
        })
      ])
    );
    expect(dataset.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^fake-cat-/)
        })
      ])
    );
  });

  it("uses the real dataset by default", () => {
    const dataset = getCatalogDataset(
      new Request("http://localhost/api/products"),
      {}
    );

    expect(dataset.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "prod-hardware-ia"
        })
      ])
    );
  });
});
