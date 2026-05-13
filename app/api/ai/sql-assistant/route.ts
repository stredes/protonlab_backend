import {
  createSqlAssistantHandler,
  createSqlAssistantService
} from "../../../../src/server/sql-assistant";
import { getFirebaseAuth } from "../../../../src/lib/firebaseAdmin";
import { ROLES, type Role } from "../../../../src/models/user";
import { requireAuth, requireRole } from "../../../../src/middleware/auth";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];
const sqlAssistantService = createSqlAssistantService();

function resolveUserRole(value: unknown): Role {
  if (typeof value === "string" && ROLES.includes(value as Role)) {
    return value as Role;
  }

  return "cliente";
}

const authenticate = requireAuth({
  verifyToken: async (token) => {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    const customClaims = decodedToken as Record<string, unknown>;

    return {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      role: resolveUserRole(
        customClaims.role ??
          customClaims["https://protonlab.cl/role"] ??
          customClaims["https://schemas.protonlab.cl/role"]
      )
    };
  }
});
const handleSqlAssistant = createSqlAssistantHandler({
  authorize: async (request) => {
    const authResult = await authenticate(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    const roleResult = requireRole([
      "root",
      "admin",
      "vendedor",
      "bodega",
      "callcenter",
      "soporte"
    ])(authResult.context);

    if (!roleResult.ok) {
      return roleResult.response;
    }

    return null;
  },
  generateQuery: (input) => sqlAssistantService.generateQuery(input)
});

export async function POST(request: Request): Promise<Response> {
  const response = await handleSqlAssistant(request);

  return withCors(response, request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
