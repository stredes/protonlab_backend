import {
  createSqlAssistantHandler,
  createSqlAssistantService
} from "../../../../src/server/sql-assistant";
import { getCatalogDataset } from "../../../../src/server/catalog";
import { adminDb, getFirebaseAuth } from "../../../../src/lib/firebaseAdmin";
import { ROLES, type Role } from "../../../../src/models/user";
import { requireAuth, requireRole } from "../../../../src/middleware/auth";
import { resolveRoleFromClaims } from "../../../../src/server/auth";
import {
  isProductQuestion,
  isUserQuestion
} from "../../../../src/server/sql-assistant-intent";
import { createPreflightResponse, withCors } from "../../../../src/utils/cors";

const methods = ["POST", "OPTIONS"];
const sqlAssistantService = createSqlAssistantService();
const maxEvidenceItems = 10;
const heavyProcessThresholdMs = 3000;

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

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

async function resolveUserInventoryAnswer(
  request: Request,
  question: string
) {
  if (!isUserQuestion(question)) {
    return null;
  }

  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const auth = getFirebaseAuth();
  const decodedToken = await auth.verifyIdToken(token);
  const role = resolveUserRole(
    resolveRoleFromClaims(decodedToken as Record<string, unknown>)
  );

  if (role !== "root" && role !== "admin") {
    return null;
  }

  const startedAt = Date.now();
  const evidence: string[] = [];
  let total = 0;
  let pageToken: string | undefined;
  let hasMore = false;

  do {
    const page = await auth.listUsers(1000, pageToken);
    total += page.users.length;

    for (const user of page.users) {
      if (evidence.length >= maxEvidenceItems) {
        break;
      }

      const claims = user.customClaims ?? {};
      const userRole =
        typeof claims.role === "string" ? `, rol ${claims.role}` : "";
      const displayName = user.displayName || "Sin nombre";
      const email = user.email || "sin correo";

      evidence.push(`${displayName} <${email}>${userRole}`);
    }

    pageToken = page.pageToken;
    hasMore = Boolean(pageToken);
  } while (pageToken);

  const elapsedMs = Date.now() - startedAt;
  const hasEtc = total > evidence.length || hasMore;
  const answer =
    total === 1
      ? "En el sistema existe 1 usuario registrado."
      : `En el sistema existen ${total} usuarios registrados.`;
  const notice =
    elapsedMs > heavyProcessThresholdMs || total > 1000
      ? "Este cálculo revisa el inventario completo de usuarios. Si el volumen crece, el sistema puede tardar un poco más en procesarlo."
      : null;

  return {
    sql: "",
    answer,
    explanation: hasEtc
      ? `${answer} Como evidencia muestro los primeros ${evidence.length}; hay más registros en el sistema.`
      : `${answer} La evidencia incluye todos los usuarios encontrados.`,
    assumptions: [
      "El conteo se obtuvo desde Firebase Auth, no desde una tabla SQL."
    ],
    evidence: hasEtc ? [...evidence, "etc."] : evidence,
    notice,
    model: "firebase-admin"
  };
}

async function resolveProductCatalogAnswer(request: Request, question: string) {
  if (!isProductQuestion(question)) {
    return null;
  }

  type ProductEvidence = {
    name: string;
    sku: string;
    availability: string;
    price?: number;
    currency: string;
  };

  const startedAt = Date.now();
  let products: ProductEvidence[] = getCatalogDataset(request).products.map((product) => ({
    name: product.name,
    sku: product.sku,
    availability: product.availability,
    price: product.price,
    currency: product.currency ?? "USD"
  }));
  let source = "catálogo operativo del backend";

  try {
    const snapshot = await adminDb.collection("products").get();
    if (!snapshot.empty) {
      products = snapshot.docs.map((document) => {
        const data = document.data();

        return {
          name:
            typeof data.name === "string"
              ? data.name
              : typeof data.nombre === "string"
                ? data.nombre
                : document.id,
          sku:
            typeof data.sku === "string"
              ? data.sku
              : typeof data.code === "string"
                ? data.code
                : document.id,
          availability:
            typeof data.availability === "string"
              ? data.availability
              : "sin estado",
          price:
            typeof data.price === "number"
              ? data.price
              : typeof data.precio === "number"
                ? data.precio
                : undefined,
          currency: typeof data.currency === "string" ? data.currency : "USD"
        };
      });
      source = "Firestore products";
    }
  } catch {
    source = "catálogo operativo del backend";
  }

  const evidence = products.slice(0, maxEvidenceItems).map((product) => {
    const price =
      typeof product.price === "number"
        ? `, precio ${product.currency} ${product.price}`
        : "";

    return `${product.name} (${product.sku}), disponibilidad ${product.availability}${price}`;
  });
  const hasEtc = products.length > evidence.length;
  const answer =
    products.length === 1
      ? "En el catálogo existe 1 producto registrado."
      : `En el catálogo existen ${products.length} productos registrados.`;
  const notice =
    Date.now() - startedAt > heavyProcessThresholdMs || products.length > 1000
      ? "Este cálculo revisa el catálogo completo de productos. Si el volumen crece, el sistema puede tardar un poco más en procesarlo."
      : null;

  return {
    sql: "",
    answer,
    explanation: hasEtc
      ? `${answer} Como evidencia muestro los primeros ${evidence.length}; hay más productos en el catálogo.`
      : `${answer} La evidencia incluye todos los productos encontrados.`,
    assumptions: [
      `El conteo se obtuvo desde ${source}.`
    ],
    evidence: hasEtc ? [...evidence, "etc."] : evidence,
    notice,
    model: "catalog-service"
  };
}

async function resolveDirectOperationalAnswer(
  request: Request,
  question: string
) {
  return (
    (await resolveUserInventoryAnswer(request, question)) ??
    resolveProductCatalogAnswer(request, question)
  );
}

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
  resolveHumanAnswer: (input, request) =>
    resolveDirectOperationalAnswer(request, input.question),
  generateQuery: (input) => sqlAssistantService.generateQuery(input)
});

export async function POST(request: Request): Promise<Response> {
  const response = await handleSqlAssistant(request);

  return withCors(response, request, methods);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return createPreflightResponse(request, methods);
}
