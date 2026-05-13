import { fail, ok } from "../utils/responses";
import {
  sqlAssistantRequestSchema,
  type SqlAssistantRequest
} from "../validation/sql-assistant";

type SqlAssistantEnv = Partial<
  Record<
    | "AI_SQL_API_URL"
    | "AI_SQL_API_KEY"
    | "AI_SQL_MODEL"
    | "AI_SQL_APP_NAME"
    | "AI_SQL_SITE_URL",
    string
  >
>;

type SqlAssistantDependencies = {
  env?: SqlAssistantEnv;
  fetchFn?: typeof fetch;
};

type ProviderMessage = {
  content?: string | null;
};

type ProviderChoice = {
  message?: ProviderMessage | null;
};

type ProviderResponse = {
  choices?: ProviderChoice[];
};

export type SqlAssistantResult = {
  sql: string;
  explanation: string;
  assumptions: string[];
  model: string;
};

type SqlAssistantHandlerDependencies = {
  authorize?: (request: Request) => Promise<Response | null>;
  generateQuery: (input: SqlAssistantRequest) => Promise<SqlAssistantResult>;
};

const defaultApiUrl = "https://openrouter.ai/api/v1/chat/completions";
const defaultModel = "google/gemma-3n-e4b-it:free";
const forbiddenSqlPatterns = [
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\balter\b/i,
  /\btruncate\b/i,
  /\bcreate\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bmerge\b/i,
  /\bcall\b/i,
  /\bexec\b/i
];

function buildSystemPrompt(dialect: string): string {
  return [
    "Eres un asistente experto en SQL para Proton Lab.",
    `Genera exclusivamente consultas ${dialect} de solo lectura.`,
    "Responde solo JSON válido con las llaves sql, explanation y assumptions.",
    "La consulta debe empezar con SELECT o WITH y nunca modificar datos.",
    "Usa LIMIT cuando la petición no especifique un volumen exacto.",
    "Si debes asumir nombres de tablas o columnas, decláralo en assumptions."
  ].join(" ");
}

function buildUserPrompt(input: SqlAssistantRequest): string {
  return [
    `Pregunta del usuario: ${input.question}`,
    `Dialecto SQL: ${input.dialect ?? "PostgreSQL"}`,
    `Contexto de negocio: ${
      input.businessContext ??
      "ERP Proton Lab con clientes, cotizaciones, pedidos, inventario y despachos."
    }`,
    `Esquema disponible:\n${input.schema}`
  ].join("\n\n");
}

function ensureReadOnlySql(sql: string): string {
  const normalizedSql = sql.trim();
  const normalizedWithoutTrailingSemicolon = normalizedSql.replace(/;\s*$/, "");

  if (
    !/^(select|with)\b/i.test(normalizedWithoutTrailingSemicolon)
  ) {
    throw new Error("El modelo devolvió una consulta no válida de solo lectura.");
  }

  if (normalizedWithoutTrailingSemicolon.includes(";")) {
    throw new Error("El modelo devolvió múltiples sentencias SQL, lo cual no está permitido.");
  }

  for (const pattern of forbiddenSqlPatterns) {
    if (pattern.test(normalizedWithoutTrailingSemicolon)) {
      throw new Error("El modelo devolvió SQL fuera del modo de solo lectura.");
    }
  }

  return normalizedSql.endsWith(";") ? normalizedSql : `${normalizedSql};`;
}

function parseProviderContent(content: string): Omit<SqlAssistantResult, "model"> {
  const parsed = JSON.parse(content) as Partial<SqlAssistantResult>;

  if (
    typeof parsed.sql !== "string" ||
    typeof parsed.explanation !== "string"
  ) {
    throw new Error("La respuesta del modelo no tuvo el formato esperado.");
  }

  return {
    sql: ensureReadOnlySql(parsed.sql),
    explanation: parsed.explanation.trim(),
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.filter(
          (assumption): assumption is string =>
            typeof assumption === "string" && assumption.trim().length > 0
        )
      : []
  };
}

export function createSqlAssistantService(
  dependencies: SqlAssistantDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const fetchFn = dependencies.fetchFn ?? fetch;

  return {
    async generateQuery(input: SqlAssistantRequest): Promise<SqlAssistantResult> {
      const apiKey = env.AI_SQL_API_KEY;

      if (!apiKey) {
        throw new Error(
          "Falta configurar AI_SQL_API_KEY para usar el asistente SQL."
        );
      }

      const apiUrl = env.AI_SQL_API_URL ?? defaultApiUrl;
      const model = env.AI_SQL_MODEL ?? defaultModel;
      const dialect = input.dialect ?? "PostgreSQL";

      const response = await fetchFn(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...(env.AI_SQL_APP_NAME ? { "x-title": env.AI_SQL_APP_NAME } : {}),
          ...(env.AI_SQL_SITE_URL
            ? { "http-referer": env.AI_SQL_SITE_URL }
            : {})
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(dialect)
            },
            {
              role: "user",
              content: buildUserPrompt(input)
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`El proveedor IA respondió con estado ${response.status}.`);
      }

      const payload = (await response.json()) as ProviderResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("El proveedor IA no devolvió contenido utilizable.");
      }

      return {
        ...parseProviderContent(content),
        model
      };
    }
  };
}

export function createSqlAssistantHandler(
  dependencies: SqlAssistantHandlerDependencies
) {
  return async function handleSqlAssistant(request: Request): Promise<Response> {
    if (dependencies.authorize) {
      const authorizationFailure = await dependencies.authorize(request);

      if (authorizationFailure) {
        return authorizationFailure;
      }
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return fail("JSON inválido", {
        status: 400,
        code: "VALIDATION_ERROR",
        request
      });
    }

    const parsed = sqlAssistantRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return fail("Payload inválido para el asistente SQL", {
        status: 400,
        code: "VALIDATION_ERROR",
        request
      });
    }

    try {
      const result = await dependencies.generateQuery(parsed.data);
      return ok(result, request);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No fue posible generar una consulta SQL.";

      return fail(message, {
        status: 503,
        code: "AI_UNAVAILABLE",
        request
      });
    }
  };
}
