import {
  createSqlAssistantHandler,
  createSqlAssistantService
} from "../../../../src/server/sql-assistant";
import { getFirebaseAuth } from "../../../../src/lib/firebaseAdmin";
import { requireAuth, requireRole } from "../../../../src/middleware/auth";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];
const sqlAssistantService = createSqlAssistantService();
const authenticate = requireAuth({
  verifyToken: (token) => getFirebaseAuth().verifyIdToken(token)
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
