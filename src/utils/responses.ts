type ResponseContext = {
  requestId: string;
};

type FailOptions = ResponseContext & {
  status?: number;
  code?: string;
};

function createHeaders(requestId: string): Headers {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId
  });
}

export function ok(data: unknown, context: ResponseContext, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: createHeaders(context.requestId)
  });
}

export function fail(message: string, options: FailOptions): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: options.code ?? "INTERNAL_ERROR",
      details: {
        requestId: options.requestId
      }
    }),
    {
      status: options.status ?? 500,
      headers: createHeaders(options.requestId)
    }
  );
}
