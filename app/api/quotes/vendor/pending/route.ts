import { listQuotes } from "../../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.searchParams.has("status")) {
    url.searchParams.set("status", "pendiente");
  }
  return withCors(await listQuotes(new Request(url, request)), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
