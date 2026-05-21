import { updateSupportTicket } from "../../../../../src/server/operations";
import { createPreflightResponse, withCors } from "../../../../../src/utils/cors";

const methods = ["PATCH", "OPTIONS"];

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { ticketId } = await context.params;
  return withCors(await updateSupportTicket(request, ticketId), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
