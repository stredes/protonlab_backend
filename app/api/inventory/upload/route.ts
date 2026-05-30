import { uploadInventory } from "../../../../src/server/warehouse";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];

export async function POST(request: Request): Promise<Response> {
  return withCors(await uploadInventory(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
