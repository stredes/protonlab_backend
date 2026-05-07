import { categories, products, type CatalogProduct } from "../data/catalog";
import { fail, ok } from "../utils/responses";

export function listCategories(request: Request): Response {
  return ok(categories, request);
}

export function listProducts(request: Request): Response {
  return ok(products, request);
}

export function getProductBySlug(request: Request, slug: string): Response {
  const product = products.find((entry) => entry.slug === slug);

  if (!product) {
    return fail("Producto no encontrado", {
      status: 404,
      code: "NOT_FOUND",
      request
    });
  }

  return ok(product, request);
}

export function getProductCatalog(): CatalogProduct[] {
  return products;
}
