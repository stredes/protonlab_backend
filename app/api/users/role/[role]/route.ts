import { createUserManagementHandler } from "../../../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];
const handler = createUserManagementHandler();

type RouteContext = {
  params: Promise<{
    role: string;
  }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { role } = await context.params;
  return withCors(await handler.listByRole(request, role), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
