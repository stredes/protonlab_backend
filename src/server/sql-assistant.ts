import { fail, ok } from "../utils/responses";
import {
  sqlAssistantRequestSchema,
  type SqlAssistantRequest
} from "../validation/sql-assistant";
import { buildAiContextRegistryPrompt } from "./ai-context";

type SqlAssistantEnv = Partial<
  Record<
    | "AI_SQL_API_URL"
    | "AI_SQL_API_KEY"
    | "AI_SQL_PROVIDER"
    | "AI_SQL_MODEL"
    | "AI_SQL_APP_NAME"
    | "AI_SQL_SITE_URL",
    string
  > & {
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GOOGLE_AI_API_KEY?: string;
    OLLAMA_API_URL?: string;
    OLLAMA_API_KEY?: string;
  }
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
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  response?: string;
};

export type SqlAssistantResult = {
  sql: string;
  answer: string;
  explanation: string;
  assumptions: string[];
  evidence: string[];
  notice: string | null;
  model: string;
};

type SqlAssistantHandlerDependencies = {
  authorize?: (request: Request) => Promise<Response | null>;
  resolveHumanAnswer?: (
    input: SqlAssistantRequest,
    request: Request
  ) => Promise<SqlAssistantResult | null>;
  generateQuery: (input: SqlAssistantRequest) => Promise<SqlAssistantResult>;
};

const defaultApiUrl = "https://openrouter.ai/api/v1/chat/completions";
const defaultOpenAiApiUrl = "https://api.openai.com/v1/responses";
const defaultGeminiApiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const defaultOllamaApiUrl = "http://localhost:11434";
const defaultModel = "google/gemma-3n-e4b-it:free";
const defaultOpenAiModel = "gpt-4o-mini";
const defaultGeminiModel = "gemini-2.0-flash";
const defaultOllamaModel = "llama3.1:8b";
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
    "Responde solo JSON válido con las llaves sql, answer, explanation, assumptions, evidence y notice.",
    "answer debe ser una respuesta breve en lenguaje humano para el usuario.",
    "evidence debe contener hasta 10 evidencias legibles si la consulta lo permite; si no hay evidencia directa, usa un arreglo vacío.",
    "notice debe ser null o un aviso amable si el proceso puede tardar por volumen o complejidad.",
    "La consulta debe empezar con SELECT o WITH y nunca modificar datos.",
    "Usa LIMIT cuando la petición no especifique un volumen exacto.",
    "Si debes asumir nombres de tablas o columnas, decláralo en assumptions."
  ].join(" ");
}

function buildUserPrompt(input: SqlAssistantRequest): string {
  const schemaContext = input.schema
    ? `Esquema adicional enviado por el cliente:\n${input.schema}`
    : "Esquema adicional enviado por el cliente: no informado. Usar el catálogo operativo ProtonLab.";

  return [
    `Pregunta del usuario: ${input.question}`,
    `Dialecto SQL: ${input.dialect ?? "PostgreSQL"}`,
    `Contexto de negocio: ${
      input.businessContext ??
      "ERP Proton Lab con clientes, cotizaciones, pedidos, inventario y despachos."
    }`,
    buildAiContextRegistryPrompt(),
    schemaContext
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
    answer:
      typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : parsed.explanation.trim(),
    explanation: parsed.explanation.trim(),
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.filter(
          (assumption): assumption is string =>
            typeof assumption === "string" && assumption.trim().length > 0
        )
      : [],
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence
          .filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0
          )
          .slice(0, 10)
      : [],
    notice:
      typeof parsed.notice === "string" && parsed.notice.trim()
        ? parsed.notice.trim()
        : null
  };
}

function extractProviderContent(payload: ProviderResponse): string | undefined {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const item of output.content ?? []) {
      if (item.refusal) {
        throw new Error(item.refusal);
      }

      if (item.type === "output_text" && item.text) {
        return item.text;
      }
    }
  }

  return payload.choices?.[0]?.message?.content ?? undefined;
}

function extractGeminiContent(payload: GeminiResponse): string | undefined {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((text): text is string => Boolean(text))
    .join("")
    .trim();
}

function extractOllamaContent(payload: OllamaResponse): string | undefined {
  return payload.message?.content?.trim() ?? payload.response?.trim();
}

function resolveOllamaChatUrl(apiUrl: string): string {
  const normalized = apiUrl.replace(/\/+$/, "");
  return normalized.endsWith("/api/chat") ? normalized : `${normalized}/api/chat`;
}

export function createSqlAssistantService(
  dependencies: SqlAssistantDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const fetchFn = dependencies.fetchFn ?? fetch;

  return {
    async generateQuery(input: SqlAssistantRequest): Promise<SqlAssistantResult> {
      const provider =
        env.AI_SQL_PROVIDER === "openai" ||
        env.AI_SQL_PROVIDER === "openrouter" ||
        env.AI_SQL_PROVIDER === "gemini" ||
        env.AI_SQL_PROVIDER === "ollama"
          ? env.AI_SQL_PROVIDER
          : env.OLLAMA_API_URL
          ? "ollama"
          : env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY
          ? "gemini"
          : env.OPENAI_API_KEY
          ? "openai"
          : "openrouter";
      const apiKey =
        provider === "openai"
          ? env.OPENAI_API_KEY
          : provider === "gemini"
          ? env.GEMINI_API_KEY ?? env.GOOGLE_AI_API_KEY
          : provider === "ollama"
          ? env.OLLAMA_API_KEY
          : env.AI_SQL_API_KEY;

      if (!apiKey && provider !== "ollama") {
        throw new Error(
          provider === "openai"
            ? "Falta configurar OPENAI_API_KEY para usar el asistente SQL."
            : provider === "gemini"
            ? "Falta configurar GEMINI_API_KEY para usar el asistente SQL."
            : "Falta configurar AI_SQL_API_KEY para usar el asistente SQL."
        );
      }

      const apiUrl =
        env.AI_SQL_API_URL ??
        (provider === "openai"
          ? defaultOpenAiApiUrl
          : provider === "gemini"
          ? defaultGeminiApiBaseUrl
          : provider === "ollama"
          ? env.OLLAMA_API_URL ?? defaultOllamaApiUrl
          : defaultApiUrl);
      const model =
        env.AI_SQL_MODEL ??
        (provider === "openai"
          ? defaultOpenAiModel
          : provider === "gemini"
          ? defaultGeminiModel
          : provider === "ollama"
          ? defaultOllamaModel
          : defaultModel);
      const dialect = input.dialect ?? "PostgreSQL";
      const messages = [
        {
          role: "system",
          content: buildSystemPrompt(dialect)
        },
        {
          role: "user",
          content: buildUserPrompt(input)
        }
      ];
      const isGemini = provider === "gemini";
      const isOllama = provider === "ollama";
      const body = isGemini
        ? {
            systemInstruction: {
              parts: [{ text: buildSystemPrompt(dialect) }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildUserPrompt(input) }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          }
        : isOllama
        ? {
            model,
            stream: false,
            format: "json",
            messages
          }
        : provider === "openai"
        ? {
            model,
            temperature: 0.1,
            input: messages,
            text: {
              format: {
                type: "json_object"
              }
            }
          }
        : {
            model,
            temperature: 0.1,
            response_format: {
              type: "json_object"
            },
            messages
          };
      const requestUrl = isGemini
        ? `${apiUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(
            model
          )}:generateContent`
        : isOllama
        ? resolveOllamaChatUrl(apiUrl)
        : apiUrl;

      const response = await fetchFn(requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(isGemini
            ? { "x-goog-api-key": apiKey }
            : isOllama && apiKey
            ? { authorization: `Bearer ${apiKey}` }
            : isOllama
            ? {}
            : { authorization: `Bearer ${apiKey}` }),
          ...(env.AI_SQL_APP_NAME ? { "x-title": env.AI_SQL_APP_NAME } : {}),
          ...(env.AI_SQL_SITE_URL
            ? { "http-referer": env.AI_SQL_SITE_URL }
            : {})
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`El proveedor IA respondió con estado ${response.status}.`);
      }

      const payload = await response.json();
      const content = isGemini
        ? extractGeminiContent(payload as GeminiResponse)
        : isOllama
        ? extractOllamaContent(payload as OllamaResponse)
        : extractProviderContent(payload as ProviderResponse);

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
      const directAnswer = await dependencies.resolveHumanAnswer?.(
        parsed.data,
        request
      );

      if (directAnswer) {
        return ok(directAnswer, request);
      }

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
