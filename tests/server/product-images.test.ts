import { describe, expect, it, vi } from "vitest";

import { createProductImageHandler, getLatestProductImageMap } from "../../src/server/product-images";

describe("product image blob integration", () => {
  it("maps the latest blob image by product and variant", async () => {
    const images = await getLatestProductImageMap({
      listBlobs: vi.fn().mockResolvedValue({
        blobs: [
          {
            pathname: "products/prod-hardware-ia/primary-old.png",
            url: "https://blob.vercel.dev/old.png",
            uploadedAt: new Date("2026-05-20T10:00:00.000Z")
          },
          {
            pathname: "products/prod-hardware-ia/primary-new.png",
            url: "https://blob.vercel.dev/new.png",
            uploadedAt: new Date("2026-05-21T10:00:00.000Z")
          },
          {
            pathname: "products/prod-hardware-ia/hover-new.png",
            url: "https://blob.vercel.dev/hover.png",
            uploadedAt: new Date("2026-05-21T11:00:00.000Z")
          }
        ]
      })
    });

    expect(images.get("prod-hardware-ia")).toEqual({
      image: "https://blob.vercel.dev/new.png",
      hoverImage: "https://blob.vercel.dev/hover.png"
    });
  });

  it("uploads product images to a public blob path when the user is allowed", async () => {
    const uploadBlob = vi.fn().mockResolvedValue({
      url: "https://blob.vercel.dev/products/prod-hardware-ia/primary-file.png",
      pathname: "products/prod-hardware-ia/primary-file.png"
    });
    const handler = createProductImageHandler({
      authorize: vi.fn().mockResolvedValue(null),
      uploadBlob
    });
    const formData = new FormData();
    formData.set("productId", "prod-hardware-ia");
    formData.set("variant", "primary");
    formData.set("file", new File(["image"], "Foto Producto.png", { type: "image/png" }));

    const response = await handler.upload(
      new Request("http://localhost/api/uploads/product-images", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(201);
    expect(uploadBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/prod-hardware-ia\/primary-\d+-foto-producto\.png$/),
      expect.any(File),
      expect.objectContaining({
        access: "public",
        contentType: "image/png"
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        productId: "prod-hardware-ia",
        variant: "primary",
        url: "https://blob.vercel.dev/products/prod-hardware-ia/primary-file.png"
      }
    });
  });

  it("rejects non image uploads", async () => {
    const handler = createProductImageHandler({
      authorize: vi.fn().mockResolvedValue(null),
      uploadBlob: vi.fn()
    });
    const formData = new FormData();
    formData.set("productId", "prod-hardware-ia");
    formData.set("file", new File(["text"], "notes.txt", { type: "text/plain" }));

    const response = await handler.upload(
      new Request("http://localhost/api/uploads/product-images", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR"
    });
  });
});
