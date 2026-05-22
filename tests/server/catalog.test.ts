import { describe, expect, it } from "vitest";

import {
  getCatalogDataset,
  getProductBySlugWithBlobImage,
  listProductsWithBlobImages
} from "../../src/server/catalog";

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

  it("enriches product images with the latest Vercel Blob URL", async () => {
    const response = await listProductsWithBlobImages(
      new Request("http://localhost/api/products"),
      {
        listBlobs: async () => ({
          blobs: [
            {
              pathname: "products/prod-hardware-ia/primary-latest.png",
              url: "https://blob.vercel.dev/products/prod-hardware-ia/primary-latest.png",
              uploadedAt: new Date("2026-05-21T10:00:00.000Z")
            }
          ]
        })
      },
      {}
    );
    const payload = await response.json();

    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "prod-hardware-ia",
          image: "https://blob.vercel.dev/products/prod-hardware-ia/primary-latest.png"
        })
      ])
    );
  });

  it("enriches product detail images with the latest Vercel Blob URL", async () => {
    const response = await getProductBySlugWithBlobImage(
      new Request("http://localhost/api/products/slug/cluster-ia-nexus"),
      "cluster-ia-nexus",
      {
        listBlobs: async () => ({
          blobs: [
            {
              pathname: "products/prod-hardware-ia/primary-detail.png",
              url: "https://blob.vercel.dev/products/prod-hardware-ia/primary-detail.png",
              uploadedAt: new Date("2026-05-21T10:00:00.000Z")
            }
          ]
        })
      },
      {}
    );
    const payload = await response.json();

    expect(payload.data).toEqual(
      expect.objectContaining({
        id: "prod-hardware-ia",
        image: "https://blob.vercel.dev/products/prod-hardware-ia/primary-detail.png"
      })
    );
  });
});
