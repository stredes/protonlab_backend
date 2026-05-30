import { listWarehouseCatalog } from "../../../../../src/server/warehouse";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    endpoint: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { endpoint } = await context.params;
  return withCors(await listWarehouseCatalog(request, endpoint), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
