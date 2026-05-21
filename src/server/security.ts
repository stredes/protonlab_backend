import { fail } from "../utils/responses";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const securityHeaders: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "0",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'self'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';"
};

export function checkRateLimit(
  request: Request,
  options: {
    limit?: number;
    windowMs?: number;
    key?: string;
  } = {}
): Response | null {
  const limit = options.limit ?? 120;
  const windowMs = options.windowMs ?? 60_000;
  const key =
    options.key ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return fail("Demasiadas solicitudes", {
      status: 429,
      code: "RATE_LIMITED",
      request
    });
  }

  return null;
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
