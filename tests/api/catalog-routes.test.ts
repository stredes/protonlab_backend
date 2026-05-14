import { describe, expect, it } from "vitest";

import { GET as getCategories, OPTIONS as categoriesOptions } from "../../app/api/categories/route";
import { GET as getProducts } from "../../app/api/products/route";
import { GET as getProductBySlug } from "../../app/api/products/slug/[slug]/route";
import { OPTIONS as quotesOptions, POST as postQuote } from "../../app/api/quotes/route";

describe("catalog routes", () => {
  it("returns public categories with standard response shape", async () => {
    const response = await getCategories(
      new Request("http://localhost/api/categories", {
        method: "GET",
        headers: {
          origin: "http://localhost:5173"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173"
    );

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          slug: expect.any(String)
        })
      ])
    );
  });

  it("returns public products with standard response shape", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          sku: expect.any(String),
          slug: expect.any(String),
          name: expect.any(String)
        })
      ])
    );
  });

  it("returns fake products when mock=fake is requested", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?mock=fake", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^fake-/),
          slug: expect.any(String),
          name: expect.any(String)
        })
      ])
    );
  });

  it("returns fake categories when mock=fake is requested", async () => {
    const response = await getCategories(
      new Request("http://localhost/api/categories?mock=fake", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^fake-cat-/),
          slug: expect.any(String),
          name: expect.any(String)
        })
      ])
    );
  });

  it("returns a product by slug", async () => {
    const response = await getProductBySlug(
      new Request("http://localhost/api/products/slug/cluster-ia-nexus", {
        method: "GET"
      }),
      { params: Promise.resolve({ slug: "cluster-ia-nexus" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        slug: "cluster-ia-nexus"
      })
    });
  });

  it("returns not found for an unknown product slug", async () => {
    const response = await getProductBySlug(
      new Request("http://localhost/api/products/slug/missing-product", {
        method: "GET"
      }),
      { params: Promise.resolve({ slug: "missing-product" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "NOT_FOUND"
    });
  });

  it("accepts quote requests from the frontend checkout", async () => {
    const response = await postQuote(
      new Request("http://localhost/api/quotes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173"
        },
        body: JSON.stringify({
          email: "compras@cliente.cl",
          items: [
            {
              productId: "prod-hardware-ia",
              sku: "HW-IA-001",
              name: "Clúster de IA Nexus Server",
              quantity: 2,
              unitPrice: 45000,
              currency: "USD"
            }
          ],
          shippingAddress: {
            firstName: "Ana",
            lastName: "Pérez",
            addressLine1: "Av. Siempre Viva 123",
            city: "Santiago",
            postalCode: "7500000",
            country: "CL"
          },
          paymentMethod: "card",
          notes: "Solicitar instalación y puesta en marcha"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173"
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        quoteId: expect.any(String),
        status: "pendiente"
      })
    });
  });

  it("rejects invalid quote payloads", async () => {
    const response = await postQuote(
      new Request("http://localhost/api/quotes", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: "compras@cliente.cl",
          items: []
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR"
    });
  });

  it("responds to preflight requests for public endpoints", async () => {
    const categoriesResponse = await categoriesOptions(
      new Request("http://localhost/api/categories", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173"
        }
      })
    );
    const quotesResponse = await quotesOptions(
      new Request("http://localhost/api/quotes", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173"
        }
      })
    );

    expect(categoriesResponse.status).toBe(204);
    expect(categoriesResponse.headers.get("access-control-allow-methods")).toContain(
      "GET"
    );
    expect(quotesResponse.status).toBe(204);
    expect(quotesResponse.headers.get("access-control-allow-methods")).toContain(
      "POST"
    );
  });
});
