import { firestoreHealthCheck } from "../lib/firestore";
import { fail, ok } from "../utils/responses";

type HealthDependencies = {
  firestoreCheck?: () => Promise<boolean>;
};

export function createHealthHandler(dependencies: HealthDependencies = {}) {
  const checkFirestore = dependencies.firestoreCheck ?? firestoreHealthCheck;

  return {
    async health(request: Request): Promise<Response> {
      return ok(
        {
          service: "protonlab-backend",
          status: "ok"
        },
        request
      );
    },
    async ready(request: Request): Promise<Response> {
      const firestoreReady = await checkFirestore();

      if (!firestoreReady) {
        return fail("Dependencias no disponibles", {
          status: 503,
          code: "SERVICE_UNAVAILABLE",
          request
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
        request
      );
    }
  };
}
