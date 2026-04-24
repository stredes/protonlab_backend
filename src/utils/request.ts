export function getRequestId(request: Request): string {
  const existing = request.headers.get("x-request-id");
  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}
