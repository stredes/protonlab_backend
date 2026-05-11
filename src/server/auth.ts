import { getFirebaseAuth } from "../lib/firebaseAdmin";
import { fail, ok } from "../utils/responses";
import { getRequestId } from "../utils/request";
import type { DecodedIdToken } from "firebase-admin/auth";

type UserRole =
  | "root"
  | "admin"
  | "vendedor"
  | "bodega"
  | "callcenter"
  | "soporte"
  | "socio";

interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  vendorId?: string;
  phone?: string;
  department?: string;
  isActive?: boolean;
}

const VALID_ROLES: UserRole[] = [
  "root",
  "admin",
  "vendedor",
  "bodega",
  "callcenter",
  "soporte",
  "socio"
];

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

function parseRole(rawRole: unknown): UserRole {
  if (typeof rawRole === "string" && VALID_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }

  return "socio";
}

function buildUserFromToken(decoded: DecodedIdToken): ApiUser {
  const claims = decoded as Record<string, unknown>;
  const email = decoded.email ?? "";
  const name =
    typeof decoded.name === "string" && decoded.name.trim()
      ? decoded.name
      : email
      ? email.split("@")[0]
      : "Usuario";

  const rawRole =
    claims.role ??
    claims["https://protonlab.cl/role"] ??
    claims["https://schemas.protonlab.cl/role"];

  return {
    id: decoded.uid,
    email,
    name,
    role: parseRole(rawRole),
    company: typeof claims.company === "string" ? claims.company : "Protonlab",
    vendorId: typeof claims.vendorId === "string" ? claims.vendorId : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    department: typeof claims.department === "string" ? claims.department : undefined,
    isActive: claims.isActive === false ? false : true
  };
}

export async function getCurrentUser(request: Request): Promise<Response> {
  const requestId = getRequestId(request);
  const token = getBearerToken(request);

  if (!token) {
    return fail("Token no proporcionado", {
      requestId,
      status: 401,
      code: "TOKEN_MISSING"
    });
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    const user = buildUserFromToken(decodedToken);
    return ok({ user }, request);
  } catch {
    return fail("Token inválido o expirado", {
      requestId,
      status: 401,
      code: "TOKEN_INVALID"
    });
  }
}
