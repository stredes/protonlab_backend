import { createHealthHandler } from "../../../src/server/health";
import { withCors } from "../../../src/utils/cors";

const handler = createHealthHandler({
  firestoreCheck: async () => true
});
const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  return withCors(await handler.health(request), request, methods);
}
