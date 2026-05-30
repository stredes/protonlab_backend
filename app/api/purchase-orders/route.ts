import { createPurchaseOrder, listPurchaseOrders } from "../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const methods = ["GET", "POST", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  return withCors(await listPurchaseOrders(request), request, methods);
}

export async function POST(request: Request): Promise<Response> {
  return withCors(await createPurchaseOrder(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
