import { createUserManagementHandler } from "../../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["GET", "PUT", "DELETE", "OPTIONS"];
const handler = createUserManagementHandler();

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return withCors(await handler.get(request, userId), request, methods);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return withCors(await handler.update(request, userId), request, methods);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return withCors(await handler.remove(request, userId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
