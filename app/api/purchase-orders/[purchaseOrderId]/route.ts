import { getPurchaseOrder } from "../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    purchaseOrderId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { purchaseOrderId } = await context.params;
  return withCors(await getPurchaseOrder(request, purchaseOrderId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
