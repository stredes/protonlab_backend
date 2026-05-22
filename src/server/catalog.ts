import { categories, products, type CatalogProduct } from "../data/catalog";
import { createFakeCategories, createFakeProducts } from "../data/catalogFake";
import { fail, ok } from "../utils/responses";
import { getLatestProductImageMap } from "./product-images";

type CatalogEnv = Partial<Record<"PROTONLAB_USE_FAKE_CATALOG" | "PROTONLAB_ENABLE_BLOB_CATALOG", string>>;

type BlobListDependency = {
  listBlobs?: (options: { prefix: string; limit: number }) => Promise<{
    blobs: Array<{
      pathname: string;
      url: string;
      uploadedAt?: Date | string;
    }>;
  }>;
};

function getCatalogEnv(): CatalogEnv {
  return {
    PROTONLAB_USE_FAKE_CATALOG: process.env.PROTONLAB_USE_FAKE_CATALOG,
    PROTONLAB_ENABLE_BLOB_CATALOG: process.env.PROTONLAB_ENABLE_BLOB_CATALOG
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

function shouldUseBlobCatalog(env: CatalogEnv = getCatalogEnv()): boolean {
  return env.PROTONLAB_ENABLE_BLOB_CATALOG !== "false";
}

export async function listProductsWithBlobImages(
  request: Request,
  dependencies: BlobListDependency = {},
  env: CatalogEnv = getCatalogEnv()
): Promise<Response> {
  const dataset = getCatalogDataset(request, env);
  if (!shouldUseBlobCatalog(env) || !dependencies.listBlobs) {
    return ok(dataset.products, request);
  }

  try {
    const imageMap = await getLatestProductImageMap(dependencies);
    const enrichedProducts = dataset.products.map((product) => {
      const imageEntry = imageMap.get(product.id);
      if (!imageEntry) return product;

      return {
        ...product,
        image: imageEntry.image ?? product.image,
        hoverImage: imageEntry.hoverImage ?? product.hoverImage
      };
    });

    return ok(enrichedProducts, request);
  } catch {
    return ok(dataset.products, request);
  }
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

export async function getProductBySlugWithBlobImage(
  request: Request,
  slug: string,
  dependencies: BlobListDependency = {},
  env: CatalogEnv = getCatalogEnv()
): Promise<Response> {
  const dataset = getCatalogDataset(request, env);
  const product = dataset.products.find((entry) => entry.slug === slug);

  if (!product) {
    return fail("Producto no encontrado", {
      status: 404,
      code: "NOT_FOUND",
      request
    });
  }

  if (!shouldUseBlobCatalog(env) || !dependencies.listBlobs) {
    return ok(product, request);
  }

  try {
    const imageEntry = (await getLatestProductImageMap(dependencies)).get(product.id);
    return ok(
      imageEntry
        ? {
            ...product,
            image: imageEntry.image ?? product.image,
            hoverImage: imageEntry.hoverImage ?? product.hoverImage
          }
        : product,
      request
    );
  } catch {
    return ok(product, request);
  }
}

export function getProductCatalog(): CatalogProduct[] {
  return products;
}
