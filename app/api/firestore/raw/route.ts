import { getFirebaseAuth, adminDb } from "../../../../src/lib/firebaseAdmin";
import { requireAuth, requireRole } from "../../../../src/middleware/auth";
import { ROLES, type Role } from "../../../../src/models/user";
import { resolveRoleFromClaims } from "../../../../src/server/auth";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";
import { fail, ok } from "../../../../src/utils/responses";

const methods = ["GET", "OPTIONS"];
const maxLimit = 100;

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
      role: resolveUserRole(resolveRoleFromClaims(customClaims))
    };
  }
});

function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  if (
    "path" in value &&
    typeof value.path === "string"
  ) {
    return { __type: "DocumentReference", path: value.path };
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      serializeFirestoreValue(entry)
    ])
  );
}

function parseLimit(rawLimit: string | null): number {
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 25;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, maxLimit);
}

async function authorize(request: Request): Promise<Response | null> {
  const authResult = await authenticate(request);
  if (!authResult.ok) return authResult.response;

  const roleResult = requireRole(["root", "admin"])(authResult.context);
  return roleResult.ok ? null : roleResult.response;
}

export async function GET(request: Request): Promise<Response> {
  const authorizationFailure = await authorize(request);
  if (authorizationFailure) {
    return withCors(authorizationFailure, request, methods);
  }

  const url = new URL(request.url);
  const collection = url.searchParams.get("collection")?.trim();

  if (!collection) {
    const collections = await adminDb.listCollections();

    return withCors(
      ok(
        {
          collections: collections.map((item) => item.id).sort()
        },
        request
      ),
      request,
      methods
    );
  }

  if (collection.includes("/") || collection.includes("..")) {
    return withCors(
      fail("Colección inválida", {
        request,
        status: 400,
        code: "VALIDATION_ERROR"
      }),
      request,
      methods
    );
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const snapshot = await adminDb.collection(collection).limit(limit).get();

  return withCors(
    ok(
      {
        collection,
        limit,
        count: snapshot.size,
        documents: snapshot.docs.map((document) => ({
          id: document.id,
          path: document.ref.path,
          data: serializeFirestoreValue(document.data())
        }))
      },
      request
    ),
    request,
    methods
  );
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
