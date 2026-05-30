import { products } from "../data/catalog";
import { fail, ok } from "../utils/responses";
import {
  InputValidationError,
  assertSafePayload,
  parsePageNumber,
  safeCsvCell,
  sanitizeText
} from "./input-security";

export type WarehouseStockItem = {
  familia: string;
  subfamilia: string;
  producto: string;
  unidad: string;
  unidadNegocio: string;
  bodega: string;
  ubicacion: string;
  serie?: string;
  lote?: string | null;
  fechaVencimiento?: string | null;
  porLlegar: number;
  reserva: number;
  saldoStock: number;
  codigoArticulo: string;
  marca: string;
  origen: string;
  isTemporaryStock?: boolean;
  date: string;
};

type InventoryUploadProduct = {
  sku?: string;
  name?: string;
  slug?: string;
  categoryId?: string;
  brand?: string;
  stock?: number;
  specs?: Record<string, string>;
};

const today = new Date().toISOString().slice(0, 10);

const uploadedStock: WarehouseStockItem[] = [];

const baseStock: WarehouseStockItem[] = products.map((product, index) => {
  const stock = 24 + index * 7;

  return {
    familia: product.family ?? product.categoryId ?? "Hardware",
    subfamilia: product.subfamily ?? product.brand ?? "General",
    producto: product.name,
    unidad: "UN",
    unidadNegocio: product.categoryId ?? "ProtonLab",
    bodega: index % 2 === 0 ? "Bodega Central" : "Bodega Técnica",
    ubicacion: `P${index + 1}-R${(index % 4) + 1}`,
    lote: `L-${String(index + 1).padStart(3, "0")}`,
    fechaVencimiento: index % 3 === 0 ? "2026-09-30" : null,
    porLlegar: index % 2 === 0 ? 8 : 0,
    reserva: index % 4,
    saldoStock: stock,
    codigoArticulo: product.sku ?? product.id,
    marca: product.brand ?? "ProtonLab",
    origen: "Chile",
    isTemporaryStock: false,
    date: today
  };
});

function getAllStock(): WarehouseStockItem[] {
  return [...uploadedStock, ...baseStock];
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesText(value: string | undefined | null, query: string): boolean {
  if (!query) return true;
  return normalize(value ?? "").includes(normalize(query));
}

function equalsFilter(value: string | undefined | null, filter: string | null): boolean {
  if (!filter) return true;
  return normalize(value ?? "") === normalize(filter);
}

function uniqueSorted(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function filterStock(request: Request): WarehouseStockItem[] {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const familia = url.searchParams.get("familia");
  const subfamilia = url.searchParams.get("subfamilia");
  const bodega = url.searchParams.get("bodega");
  const ubicacion = url.searchParams.get("ubicacion");
  const codigoArticulo = url.searchParams.get("codigoArticulo");
  const unidadNegocio = url.searchParams.get("unidadNegocio");
  const marca = url.searchParams.get("marca");
  const origen = url.searchParams.get("origen");
  const includeTemporaryStock = url.searchParams.get("includeTemporaryStock") !== "false";
  const hideNoStock = url.searchParams.get("hideNoStock") === "true";

  return getAllStock().filter((item) => {
    const searchable = [
      item.producto,
      item.codigoArticulo,
      item.familia,
      item.subfamilia,
      item.marca,
      item.bodega,
      item.ubicacion
    ].join(" ");

    return (
      includesText(searchable, search) &&
      equalsFilter(item.familia, familia) &&
      equalsFilter(item.subfamilia, subfamilia) &&
      equalsFilter(item.bodega, bodega) &&
      equalsFilter(item.ubicacion, ubicacion) &&
      includesText(item.codigoArticulo, codigoArticulo ?? "") &&
      includesText(item.unidadNegocio, unidadNegocio ?? "") &&
      includesText(item.marca, marca ?? "") &&
      includesText(item.origen, origen ?? "") &&
      (includeTemporaryStock || !item.isTemporaryStock) &&
      (!hideNoStock || item.saldoStock > 0)
    );
  });
}

export async function listWarehouseStock(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = parsePageNumber(url.searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePageNumber(url.searchParams.get("pageSize"), 25, 200);
  const filtered = filterStock(request);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return ok(
    {
      items,
      total: filtered.length,
      page,
      pageSize,
      summary: {
        totalStock: filtered.reduce((sum, item) => sum + item.saldoStock, 0),
        totalReserva: filtered.reduce((sum, item) => sum + item.reserva, 0),
        totalPorLlegar: filtered.reduce((sum, item) => sum + item.porLlegar, 0)
      }
    },
    request
  );
}

export async function listWarehouseCatalog(request: Request, endpoint: string): Promise<Response> {
  const url = new URL(request.url);
  const familia = url.searchParams.get("familia");
  const bodega = url.searchParams.get("bodega");
  const stock = getAllStock();

  const valuesByEndpoint: Record<string, string[]> = {
    familias: uniqueSorted(stock.map((item) => item.familia)),
    subfamilias: uniqueSorted(
      stock.filter((item) => equalsFilter(item.familia, familia)).map((item) => item.subfamilia)
    ),
    bodegas: uniqueSorted(stock.map((item) => item.bodega)),
    ubicaciones: uniqueSorted(
      stock.filter((item) => equalsFilter(item.bodega, bodega)).map((item) => item.ubicacion)
    ),
    marcas: uniqueSorted(stock.map((item) => item.marca)),
    origenes: uniqueSorted(stock.map((item) => item.origen)),
    "unidades-negocio": uniqueSorted(stock.map((item) => item.unidadNegocio))
  };

  const values = valuesByEndpoint[endpoint];
  if (!values) {
    return fail("Catálogo de bodega no encontrado", { request, status: 404, code: "NOT_FOUND" });
  }

  return ok(values, request);
}

export async function exportWarehouseStock(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = [
    [
      "familia",
      "subfamilia",
      "codigoArticulo",
      "producto",
      "bodega",
      "ubicacion",
      "lote",
      "fechaVencimiento",
      "porLlegar",
      "reserva",
      "saldoStock",
      "marca",
      "origen"
    ],
    ...filterStock(request).map((item) => [
      item.familia,
      item.subfamilia,
      item.codigoArticulo,
      item.producto,
      item.bodega,
      item.ubicacion,
      item.lote ?? "",
      item.fechaVencimiento ?? "",
      String(item.porLlegar),
      String(item.reserva),
      String(item.saldoStock),
      item.marca,
      item.origen
    ])
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${safeCsvCell(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="stock-bodega-${new Date().toISOString().slice(0, 10)}.${format === "xlsx" ? "csv" : "csv"}"`
    }
  });
}

function uploadProductToStock(product: InventoryUploadProduct, index: number): WarehouseStockItem {
  const specs = product.specs ?? {};
  const name = sanitizeText(product.name, { field: `products.${index}.name`, required: true, maxLength: 160 })!;
  const sku = sanitizeText(product.sku ?? product.slug ?? `upload-${index + 1}`, {
    field: `products.${index}.sku`,
    required: true,
    maxLength: 100
  })!;

  return {
    familia: sanitizeText(product.categoryId ?? "Carga masiva", {
      field: `products.${index}.categoryId`,
      required: true,
      maxLength: 100
    })!,
    subfamilia: specs.subfamilia ?? "Importado",
    producto: name,
    unidad: specs.unidad ?? "UN",
    unidadNegocio: product.categoryId ?? "ProtonLab",
    bodega: specs.bodega ?? "Bodega Central",
    ubicacion: specs.ubicacion ?? "Importación",
    serie: specs.numeroSerie,
    lote: specs.lote ?? null,
    fechaVencimiento: null,
    porLlegar: 0,
    reserva: 0,
    saldoStock: Number.isFinite(product.stock) ? Math.max(0, Math.trunc(product.stock ?? 0)) : 0,
    codigoArticulo: sku,
    marca: product.brand ?? "Sin marca",
    origen: "Carga Excel",
    isTemporaryStock: true,
    date: today
  };
}

export async function uploadInventory(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as
    | { products?: InventoryUploadProduct[]; overwriteExisting?: boolean }
    | null;

  if (!payload) {
    return fail("JSON inválido", { request, status: 400, code: "VALIDATION_ERROR" });
  }

  try {
    assertSafePayload(payload);
  } catch (error) {
    if (error instanceof InputValidationError) {
      return fail(error.message, { request, status: 400, code: "VALIDATION_ERROR" });
    }
    throw error;
  }

  const productsToUpload = Array.isArray(payload.products) ? payload.products : [];
  const errors: Array<{ index: number; name: string; slug?: string; error: string; isTransient?: boolean }> = [];
  const createdIds: string[] = [];

  productsToUpload.forEach((product, index) => {
    try {
      const item = uploadProductToStock(product, index);
      const existingIndex = uploadedStock.findIndex((entry) => entry.codigoArticulo === item.codigoArticulo);
      if (existingIndex >= 0 && !payload.overwriteExisting) {
        errors.push({
          index,
          name: product.name ?? item.producto,
          slug: product.slug,
          error: "Producto ya existe en carga temporal"
        });
        return;
      }

      if (existingIndex >= 0) {
        uploadedStock.splice(existingIndex, 1, item);
      } else {
        uploadedStock.unshift(item);
      }
      createdIds.push(item.codigoArticulo);
    } catch (error) {
      errors.push({
        index,
        name: product.name ?? `Fila ${index + 1}`,
        slug: product.slug,
        error: error instanceof Error ? error.message : "Producto inválido"
      });
    }
  });

  return ok(
    {
      totalProcessed: productsToUpload.length,
      successful: productsToUpload.length - errors.length,
      failed: errors.length,
      skipped: 0,
      errors,
      createdIds
    },
    request
  );
}
