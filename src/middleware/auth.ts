import type { AuthenticatedUser, Role } from "../models/user.js";
import { fail } from "../utils/responses.js";

export type RequestContext = {
  request: Request;
  requestId: string;
  user: AuthenticatedUser;
};

type AuthSuccess = {
  ok: true;
  context: RequestContext;
};

type AuthFailure = {
  ok: false;
  response: Response;
};

type AuthResult = AuthSuccess | AuthFailure;

type TokenVerifier = (token: string) => Promise<AuthenticatedUser>;

type RequireAuthOptions = {
  verifyToken: TokenVerifier;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function requireAuth(options: RequireAuthOptions) {
  return async (request: Request, requestId = crypto.randomUUID()): Promise<AuthResult> => {
    const token = getBearerToken(request);
    if (!token) {
      return {
        ok: false,
        response: fail("Token no proporcionado", {
          status: 401,
          code: "TOKEN_MISSING",
          requestId
        })
      };
    }

    try {
      const user = await options.verifyToken(token);
      return {
        ok: true,
        context: {
          request,
          requestId,
          user
        }
      };
    } catch {
      return {
        ok: false,
        response: fail("Token inválido", {
          status: 401,
          code: "TOKEN_INVALID",
          requestId
        })
      };
    }
  };
}

export function requireRole(roles: Role[]) {
  return (context: RequestContext): AuthResult => {
    if (roles.includes(context.user.role)) {
      return {
        ok: true,
        context
      };
    }

    return {
      ok: false,
      response: fail("No autorizado", {
        status: 403,
        code: "FORBIDDEN",
        requestId: context.requestId
      })
    };
  };
}
