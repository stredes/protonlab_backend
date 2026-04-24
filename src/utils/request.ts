export function getRequestId(request: Pick<Request, "headers">): string {
  const existing = request.headers.get("x-request-id");
  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}
