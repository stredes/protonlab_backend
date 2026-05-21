import { getQuote, updateQuote } from "../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["GET", "PATCH", "PUT", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { quoteId } = await context.params;
  return withCors(await getQuote(request, quoteId), request, methods);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { quoteId } = await context.params;
  return withCors(await updateQuote(request, quoteId), request, methods);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { quoteId } = await context.params;
  return withCors(await updateQuote(request, quoteId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
