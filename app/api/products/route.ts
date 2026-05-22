import { list } from "@vercel/blob";

import { listProductsWithBlobImages } from "../../../src/server/catalog";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  return withCors(await listProductsWithBlobImages(request, { listBlobs: list }), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
