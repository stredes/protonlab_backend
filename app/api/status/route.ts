import { createStatusService } from "../../../src/server/status";
import { ok } from "../../../src/utils/responses";
import { withCors } from "../../../src/utils/cors";

const statusService = createStatusService();
const methods = ["GET", "OPTIONS"];

export async function GET(request: Request): Promise<Response> {
  const status = await statusService.getStatus();

  return withCors(ok(status, request), request, methods);
}
