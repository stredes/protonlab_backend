import { cancelOrder, getOrder, updateOrder } from "../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["GET", "PATCH", "DELETE", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { orderId } = await context.params;
  return withCors(await getOrder(request, orderId), request, methods);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { orderId } = await context.params;
  return withCors(await updateOrder(request, orderId), request, methods);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { orderId } = await context.params;
  return withCors(await cancelOrder(request, orderId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
