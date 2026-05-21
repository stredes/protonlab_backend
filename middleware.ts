import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { checkRateLimit, securityHeaders } from "./src/server/security";

export function middleware(request: NextRequest) {
  const rateLimitFailure = request.nextUrl.pathname.startsWith("/api/")
    ? checkRateLimit(request)
    : null;

  if (rateLimitFailure) {
    const response = new NextResponse(rateLimitFailure.body, {
      status: rateLimitFailure.status,
      headers: rateLimitFailure.headers
    });
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
