import { createStatusService } from "../../../src/server/status";
import { ok } from "../../../src/utils/responses";

const statusService = createStatusService();

export async function GET(request: Request): Promise<Response> {
  const status = await statusService.getStatus();

  return ok(status, request);
}
