import { createPreflightResponse, withCors } from "../../../../src/utils/cors";
import { getCurrentUser } from "../../../../src/server/auth";

const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  const response = await getCurrentUser(request);
  return withCors(response, request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
