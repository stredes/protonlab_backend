import { createUserManagementHandler } from "../../../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["PATCH", "OPTIONS"];
const handler = createUserManagementHandler();

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return withCors(await handler.setStatus(request, userId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
