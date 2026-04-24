import { createHealthHandler } from "../../../src/server/health";

const handler = createHealthHandler({
  firestoreCheck: async () => true
});

export async function GET(request: Request): Promise<Response> {
  return handler.ready(request);
}
