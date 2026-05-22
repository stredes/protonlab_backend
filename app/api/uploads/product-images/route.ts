import { list, put } from "@vercel/blob";

import { getFirebaseAuth } from "../../../../src/lib/firebaseAdmin";
import { requireAuth, requireRole } from "../../../../src/middleware/auth";
import { ROLES, type Role } from "../../../../src/models/user";
import { createProductImageHandler } from "../../../../src/server/product-images";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["GET", "POST", "OPTIONS"];

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

const handler = createProductImageHandler({
  authorize: async (request) => {
    const authResult = await authenticate(request);
    if (!authResult.ok) return authResult.response;

    const roleResult = requireRole(["root", "admin"])(authResult.context);
    return roleResult.ok ? null : roleResult.response;
  },
  uploadBlob: put,
  listBlobs: list
});

export async function GET(request: Request): Promise<Response> {
  return withCors(await handler.list(request), request, methods);
}

export async function POST(request: Request): Promise<Response> {
  return withCors(await handler.upload(request), request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
