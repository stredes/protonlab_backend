import { getRequestId } from "./request";

type RequestCarrier = Pick<Request, "headers">;

type ResponseContext =
  | {
      requestId: string;
    }
  | RequestCarrier;

type FailOptions = {
  status?: number;
  code?: string;
} & (
  | {
      requestId: string;
    }
  | {
      request: RequestCarrier;
    }
);

function createHeaders(requestId: string): Headers {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId
  });
}

function resolveRequestId(context: ResponseContext): string {
  if ("requestId" in context) {
    return context.requestId;
  }

  return getRequestId(context);
}

function resolveFailRequestId(options: FailOptions): string {
  if ("requestId" in options) {
    return options.requestId;
  }

  return getRequestId(options.request);
}

export function ok(data: unknown, context: ResponseContext, status = 200): Response {
  const requestId = resolveRequestId(context);

  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: createHeaders(requestId)
  });
}

export function fail(message: string, options: FailOptions): Response {
  const requestId = resolveFailRequestId(options);

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: options.code ?? "INTERNAL_ERROR",
      details: {
        requestId
      }
    }),
    {
      status: options.status ?? 500,
      headers: createHeaders(requestId)
    }
  );
}
