import { createUserManagementHandler } from "../../../src/server/users";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const methods = ["GET", "POST", "OPTIONS"];
const handler = createUserManagementHandler();

export async function GET(request: Request): Promise<Response> {
  return withCors(await handler.list(request), request, methods);
}

export async function POST(request: Request): Promise<Response> {
  return withCors(await handler.create(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
