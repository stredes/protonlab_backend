import { categories, products, type CatalogProduct } from "../data/catalog";
import { createFakeCategories, createFakeProducts } from "../data/catalogFake";
import { fail, ok } from "../utils/responses";

type CatalogEnv = Partial<Record<"PROTONLAB_USE_FAKE_CATALOG", string>>;

function getCatalogEnv(): CatalogEnv {
  return {
    PROTONLAB_USE_FAKE_CATALOG: process.env.PROTONLAB_USE_FAKE_CATALOG
  };
}

type CatalogDataset = {
  categories: typeof categories;
  products: CatalogProduct[];
};

function shouldUseFakeCatalog(
  request: Request,
  env: CatalogEnv = getCatalogEnv()
): boolean {
  const url = new URL(request.url);
  const mock = url.searchParams.get("mock");

  if (mock === "fake") {
    return true;
  }

  return env.PROTONLAB_USE_FAKE_CATALOG === "true";
}

export function getCatalogDataset(
  request: Request,
  env: CatalogEnv = getCatalogEnv()
): CatalogDataset {
  if (shouldUseFakeCatalog(request, env)) {
    return {
      categories: createFakeCategories(),
      products: createFakeProducts()
    };
  }

  return {
    categories,
    products
  };
}

export function listCategories(request: Request): Response {
  const dataset = getCatalogDataset(request);

  return ok(dataset.categories, request);
}

export function listProducts(request: Request): Response {
  const dataset = getCatalogDataset(request);

  return ok(dataset.products, request);
}

export function getProductBySlug(request: Request, slug: string): Response {
  const dataset = getCatalogDataset(request);
  const product = dataset.products.find((entry) => entry.slug === slug);

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
