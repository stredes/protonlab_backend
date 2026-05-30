import { createHealthHandler } from "../../../src/server/health";
import { createPreflightResponse, withCors } from "../../../src/utils/cors";

const handler = createHealthHandler({
  firestoreCheck: async () => true
});
const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  return withCors(await handler.ready(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
