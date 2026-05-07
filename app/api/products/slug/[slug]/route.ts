import { getProductBySlug } from "../../../../../src/server/catalog";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { slug } = await context.params;

  return withCors(getProductBySlug(request, slug), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
