import { fail, ok } from "../utils/responses";

export type ProductImageVariant = "primary" | "hover";

type BlobEntry = {
  pathname: string;
  url: string;
  uploadedAt?: Date | string;
};

type BlobListResult = {
  blobs: BlobEntry[];
};

type BlobUploadResult = {
  url: string;
  pathname: string;
};

type ProductImageMapEntry = {
  image?: string;
  hoverImage?: string;
};

type FormValue = string | File | null;
type UploadBody = File | ReadableStream<Uint8Array>;

type ProductImageDependencies = {
  authorize?: (request: Request) => Promise<Response | null>;
  uploadBlob: (
    pathname: string,
    body: UploadBody,
    options: {
      access: "public";
      contentType: string;
      addRandomSuffix?: boolean;
    }
  ) => Promise<BlobUploadResult>;
  listBlobs?: (options: { prefix: string; limit: number }) => Promise<BlobListResult>;
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const variants = new Set<ProductImageVariant>(["primary", "hover"]);
const productIdPattern = /^[a-z0-9][a-z0-9_-]{1,80}$/i;

function parseVariant(value: FormValue): ProductImageVariant {
  return typeof value === "string" && variants.has(value as ProductImageVariant) ? (value as ProductImageVariant) : "primary";
}

function sanitizeProductId(value: FormValue): string | null {
  if (typeof value !== "string") return null;
  const productId = value.trim();
  return productIdPattern.test(productId) ? productId : null;
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "product-image";
}

function normalizeContentType(value: string | null): string {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function getUploadedAtTime(value: BlobEntry): number {
  if (!value.uploadedAt) return 0;
  return new Date(value.uploadedAt).getTime();
}

function parseImagePath(pathname: string): { productId: string; variant: ProductImageVariant } | null {
  const match = /^products\/([^/]+)\/(primary|hover)-/i.exec(pathname);
  if (!match) return null;

  return {
    productId: match[1],
    variant: match[2] as ProductImageVariant
  };
}

export async function getLatestProductImageMap(
  dependencies: Pick<ProductImageDependencies, "listBlobs">
): Promise<Map<string, ProductImageMapEntry>> {
  if (!dependencies.listBlobs) return new Map();

  const result = await dependencies.listBlobs({ prefix: "products/", limit: 1000 });
  const sortedBlobs = [...result.blobs].sort((a, b) => getUploadedAtTime(b) - getUploadedAtTime(a));
  const images = new Map<string, ProductImageMapEntry>();

  for (const blob of sortedBlobs) {
    const parsed = parseImagePath(blob.pathname);
    if (!parsed) continue;

    const current = images.get(parsed.productId) ?? {};
    if (parsed.variant === "primary" && !current.image) {
      current.image = blob.url;
    }
    if (parsed.variant === "hover" && !current.hoverImage) {
      current.hoverImage = blob.url;
    }

    images.set(parsed.productId, current);
  }

  return images;
}

export function createProductImageHandler(dependencies: ProductImageDependencies) {
  return {
    async upload(request: Request): Promise<Response> {
      if (dependencies.authorize) {
        const authorizationFailure = await dependencies.authorize(request);
        if (authorizationFailure) return authorizationFailure;
      }

      const contentType = normalizeContentType(request.headers.get("content-type"));
      if (contentType && contentType !== "multipart/form-data" && !contentType.startsWith("multipart/")) {
        const url = new URL(request.url);
        const productId = sanitizeProductId(url.searchParams.get("productId"));
        const variant = parseVariant(url.searchParams.get("variant"));
        const filename = sanitizeFileName(url.searchParams.get("filename") ?? "product-image");

        if (!productId || !request.body) {
          return fail("Faltan productId o archivo", { status: 400, code: "VALIDATION_ERROR", request });
        }

        if (!imageTypes.has(contentType)) {
          return fail("Solo se permiten imágenes", { status: 400, code: "VALIDATION_ERROR", request });
        }

        const pathname = `products/${productId}/${variant}-${Date.now()}-${filename}`;
        const blob = await dependencies.uploadBlob(pathname, request.body, {
          access: "public",
          contentType,
          addRandomSuffix: true
        });

        return ok(
          {
            productId,
            variant,
            url: blob.url,
            pathname: blob.pathname
          },
          request,
          201
        );
      }

      const formData = await request.formData().catch(() => null);
      if (!formData) return fail("Payload multipart inválido", { status: 400, code: "VALIDATION_ERROR", request });

      const productId = sanitizeProductId(formData.get("productId"));
      const variant = parseVariant(formData.get("variant"));
      const file = formData.get("file");

      if (!productId || !(file instanceof File)) {
        return fail("Faltan productId o archivo", { status: 400, code: "VALIDATION_ERROR", request });
      }

      if (!imageTypes.has(file.type)) {
        return fail("Solo se permiten imágenes", { status: 400, code: "VALIDATION_ERROR", request });
      }

      const pathname = `products/${productId}/${variant}-${Date.now()}-${sanitizeFileName(file.name)}`;
      const blob = await dependencies.uploadBlob(pathname, file, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: true
      });

      return ok(
        {
          productId,
          variant,
          url: blob.url,
          pathname: blob.pathname
        },
        request,
        201
      );
    },

    async list(request: Request): Promise<Response> {
      const images = await getLatestProductImageMap(dependencies);
      return ok(Object.fromEntries(images), request);
    }
  };
}
