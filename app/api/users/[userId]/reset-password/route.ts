import { createUserManagementHandler } from "../../../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];
const handler = createUserManagementHandler();

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return withCors(await handler.resetPassword(request, userId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
