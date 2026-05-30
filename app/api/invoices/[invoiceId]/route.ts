import { updateInvoice } from "../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["PATCH", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { invoiceId } = await context.params;
  return withCors(await updateInvoice(request, invoiceId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
