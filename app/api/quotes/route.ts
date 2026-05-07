import { createQuote } from "../../../src/server/quotes";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];

export async function POST(request: Request): Promise<Response> {
  const response = await createQuote(request);

  return withCors(response, request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
