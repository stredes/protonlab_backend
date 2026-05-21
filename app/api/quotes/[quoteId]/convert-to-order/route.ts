import { convertQuoteToOrder } from "../../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { quoteId } = await context.params;
  return withCors(await convertQuoteToOrder(request, quoteId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
