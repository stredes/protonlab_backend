const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

function getAllowedOrigins(): string[] {
  const rawOrigins = process.env.PROTONLAB_ALLOWED_ORIGINS?.trim();

  if (!rawOrigins) {
    return defaultAllowedOrigins;
  }

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveOrigin(request: Request): string {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? "*";
}

function createCorsHeaders(request: Request, methods: string[]): Headers {
  const headers = new Headers();

  headers.set("access-control-allow-origin", resolveOrigin(request));
  headers.set("access-control-allow-methods", methods.join(", "));
  headers.set(
    "access-control-allow-headers",
    "Content-Type, Authorization, X-Request-Id"
  );
  headers.set("access-control-max-age", "86400");
  headers.set("vary", "Origin");

  return headers;
}

export function withCors(
  response: Response,
  request: Request,
  methods: string[]
): Response {
  const headers = new Headers(response.headers);
  const corsHeaders = createCorsHeaders(request, methods);

  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function createPreflightResponse(
  request: Request,
  methods: string[]
): Response {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(request, methods)
  });
}
