import { firestoreHealthCheck } from "../lib/firestore";

type StatusEnv = Partial<
  Record<
    | "VERCEL"
    | "VERCEL_ENV"
    | "VERCEL_URL"
    | "PROTONLAB_ALLOWED_ORIGINS"
    | "FIREBASE_PROJECT_ID"
    | "FIREBASE_CLIENT_EMAIL"
    | "FIREBASE_PRIVATE_KEY",
    string
  >
>;

type StatusDependencies = {
  env?: StatusEnv;
  firestoreCheck?: () => Promise<boolean>;
  fetchFn?: typeof fetch;
};

export type BackendStatus = {
  deployment: {
    provider: "vercel" | "local";
    environment: string;
  };
  backend: {
    publicUrl: string | null;
    correctlyDeployed: boolean;
  };
  frontend: {
    configured: boolean;
    expectedOrigin: string | null;
    reachable: boolean;
  };
  integrations: {
    firebaseConfigured: boolean;
    firestoreReady: boolean;
  };
  summary: {
    level: "ok" | "warning" | "error";
    items: string[];
  };
};

function normalizePublicUrl(vercelUrl?: string): string | null {
  if (!vercelUrl) {
    return null;
  }

  if (vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://")) {
    return vercelUrl;
  }

  return `https://${vercelUrl}`;
}

function getExpectedFrontendOrigin(rawOrigins?: string): string | null {
  if (!rawOrigins) {
    return null;
  }

  return (
    rawOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)[0] ?? null
  );
}

async function isFrontendReachable(
  expectedOrigin: string | null,
  fetchFn: typeof fetch
): Promise<boolean> {
  if (!expectedOrigin) {
    return false;
  }

  try {
    const response = await fetchFn(expectedOrigin, {
      method: "GET",
      signal: AbortSignal.timeout(1500)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export function createStatusService(dependencies: StatusDependencies = {}) {
  const env = dependencies.env ?? process.env;
  const checkFirestore = dependencies.firestoreCheck ?? firestoreHealthCheck;
  const fetchFn = dependencies.fetchFn ?? fetch;

  return {
    async getStatus(): Promise<BackendStatus> {
      const provider = env.VERCEL ? "vercel" : "local";
      const publicUrl = normalizePublicUrl(env.VERCEL_URL);
      const expectedOrigin = getExpectedFrontendOrigin(
        env.PROTONLAB_ALLOWED_ORIGINS
      );
      const firebaseConfigured = Boolean(
        env.FIREBASE_PROJECT_ID &&
          env.FIREBASE_CLIENT_EMAIL &&
          env.FIREBASE_PRIVATE_KEY
      );
      const firestoreReady = firebaseConfigured ? await checkFirestore() : false;
      const frontendReachable = await isFrontendReachable(
        expectedOrigin,
        fetchFn
      );

      const summaryItems: string[] = [];

      if (!publicUrl && provider === "local") {
        summaryItems.push(
          "Backend ejecutándose fuera de Vercel. Para producción valida VERCEL_URL en el despliegue."
        );
      }

      if (!expectedOrigin) {
        summaryItems.push(
          "Configura PROTONLAB_ALLOWED_ORIGINS con el dominio del frontend."
        );
      } else if (!frontendReachable) {
        summaryItems.push(
          "El frontend está configurado en CORS pero no respondió al chequeo HTTP."
        );
      }

      if (!firebaseConfigured) {
        summaryItems.push(
          "Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY."
        );
      }

      if (!firestoreReady) {
        summaryItems.push(
          "Firestore no respondió correctamente. Revisa credenciales y acceso."
        );
      }

      let level: BackendStatus["summary"]["level"] = "ok";

      if (!firebaseConfigured || !firestoreReady || !expectedOrigin) {
        level = "error";
      } else if (!frontendReachable || provider === "local") {
        level = "warning";
      }

      return {
        deployment: {
          provider,
          environment: env.VERCEL_ENV ?? "development"
        },
        backend: {
          publicUrl,
          correctlyDeployed: provider === "vercel" && Boolean(publicUrl)
        },
        frontend: {
          configured: Boolean(expectedOrigin),
          expectedOrigin,
          reachable: frontendReachable
        },
        integrations: {
          firebaseConfigured,
          firestoreReady
        },
        summary: {
          level,
          items:
            summaryItems.length > 0
              ? summaryItems
              : ["Backend desplegado y conectado con frontend/Firebase correctamente."]
        }
      };
    }
  };
}
