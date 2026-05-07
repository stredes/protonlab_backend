import { listProducts } from "../../../src/server/catalog";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  return withCors(listProducts(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
