import { approvePurchaseOrder } from "../../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    purchaseOrderId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { purchaseOrderId } = await context.params;
  return withCors(await approvePurchaseOrder(request, purchaseOrderId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
