import { firestoreHealthCheck as defaultFirestoreHealthCheck } from "../src/lib/firestore.js";
import { getRequestId } from "../src/utils/request.js";
import { fail, ok } from "../src/utils/responses.js";

type AppDependencies = {
  firestoreHealthCheck?: () => Promise<boolean>;
};

export function createApp(dependencies: AppDependencies = {}) {
  const checkFirestore =
    dependencies.firestoreHealthCheck ?? defaultFirestoreHealthCheck;

  return async function app(request: Request): Promise<Response> {
    const requestId = getRequestId(request);
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/api/health") {
      return ok(
        {
          service: "protonlab-backend",
          status: "ok"
        },
        { requestId }
      );
    }

    if (request.method === "GET" && pathname === "/api/ready") {
      const firestoreReady = await checkFirestore();
      if (!firestoreReady) {
        return fail("Dependencias no disponibles", {
          status: 503,
          code: "SERVICE_UNAVAILABLE",
          requestId
        });
      }

      return ok(
        {
          service: "protonlab-backend",
          status: "ready",
          dependencies: {
            firestore: "up"
          }
        },
        { requestId }
      );
    }

    return fail("Ruta no encontrada", {
      status: 404,
      code: "NOT_FOUND",
      requestId
    });
  };
}

const app = createApp();

export default app;
