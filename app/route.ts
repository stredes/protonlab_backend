import { renderAsciiStatus } from "../src/server/ascii-status";
import { createStatusService } from "../src/server/status";

const statusService = createStatusService();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const status = await statusService.getStatus();

  return new Response(renderAsciiStatus(status), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0"
    }
  });
}
