import { createUserManagementHandler } from "../../../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["GET", "OPTIONS"];
const handler = createUserManagementHandler();

export async function GET(request: Request): Promise<Response> {
  return withCors(await handler.audit(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
