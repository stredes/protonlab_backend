import { describe, expect, it, vi } from "vitest";

import {
  buildActionTemplate,
  classifyAssistantIntent,
  isConfirmedProductCreate,
  isGreetingQuestion,
  isProductQuestion,
  isUserQuestion
} from "../../src/server/sql-assistant-intent";
import { createSqlAssistantHandler } from "../../src/server/sql-assistant";

describe("sql assistant route handler", () => {
  it("detects user inventory questions even with common typos", () => {
    expect(isUserQuestion("cuantos susarios existen")).toBe(true);
    expect(isUserQuestion("cuantos usarios hay en el sistema")).toBe(true);
    expect(isUserQuestion("lista usuarioos")).toBe(true);
    expect(isUserQuestion("cuantos pedidos existen")).toBe(false);
  });

  it("detects product catalog questions for direct answers", () => {
    expect(isProductQuestion("cuantos productos existen")).toBe(true);
    expect(isProductQuestion("lista el catalogo")).toBe(true);
    expect(isProductQuestion("cuantos usuarios existen")).toBe(false);
  });

  it("classifies write intents with typo tolerance and builds safe templates", () => {
    expect(classifyAssistantIntent("crear prodcuto nombre Analizador precio 1200").action).toBe("create");
    expect(classifyAssistantIntent("crear prodcuto nombre Analizador precio 1200").entity).toBe("product");
    expect(classifyAssistantIntent("borrar usario admin@protonlab.cl").action).toBe("delete");
    expect(classifyAssistantIntent("borrar usario admin@protonlab.cl").entity).toBe("user");

    expect(buildActionTemplate("crear prodcuto nombre Analizador precio 1200 stock 5 sku ABC-1")).toMatchObject({
      action: "create",
      entity: "product",
      title: "Crear producto",
      confirmationRequired: true,
      detectedFields: {
        name: "analizador",
        price: 1200,
        stock: 5,
        sku: "ABC-1"
      }
    });
  });

  it("does not classify read-only user count SQL requests as delete actions", () => {
    const question = "hola dame una consulta sql de cuantos usuarios existen";

    expect(classifyAssistantIntent(question)).toMatchObject({
      action: "count",
      entity: "user",
      requiresTemplate: false
    });
    expect(buildActionTemplate(question)).toBeNull();
    expect(isUserQuestion(question)).toBe(true);
  });

  it("detects simple greetings as local assistant messages", () => {
    expect(isGreetingQuestion("hola")).toBe(true);
    expect(isGreetingQuestion("buenas tardes")).toBe(true);
    expect(isGreetingQuestion("hola dame pedidos pendientes")).toBe(false);
  });

  it("parses product template continuations and confirmation commands", () => {
    expect(classifyAssistantIntent("florero,123123,floreria,1250,2,availability")).toMatchObject({
      action: "create",
      entity: "product"
    });
    expect(buildActionTemplate("florero,123123,floreria,1250,2,availability")).toMatchObject({
      action: "create",
      entity: "product",
      detectedFields: {
        name: "florero",
        sku: "123123",
        categoryId: "floreria",
        price: 1250,
        stock: 2
      }
    });
    expect(buildActionTemplate("florero,123123,floreria,1250,2,availability")?.detectedFields.availability).toBeUndefined();
    expect(isConfirmedProductCreate("confirmar crear producto florero,123123,floreria,1250,2,disponible")).toBe(true);
  });

  it("returns a standard payload with SQL and explanation", async () => {
    const handler = createSqlAssistantHandler({
      generateQuery: vi.fn().mockResolvedValue({
        sql: "SELECT * FROM orders WHERE status = 'pendiente' LIMIT 10;",
        explanation: "Devuelve pedidos pendientes.",
        assumptions: ["La tabla orders contiene la columna status."],
        model: "openrouter/free-model"
      })
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "Muéstrame 10 pedidos pendientes",
          schema: "orders(id, status, customer_id)"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        sql: "SELECT * FROM orders WHERE status = 'pendiente' LIMIT 10;",
        explanation: "Devuelve pedidos pendientes.",
        assumptions: ["La tabla orders contiene la columna status."],
        model: "openrouter/free-model"
      }
    });
  });

  it("accepts requests without a manual schema so the backend can use its context registry", async () => {
    const generateQuery = vi.fn().mockResolvedValue({
      sql: "SELECT id, status FROM orders LIMIT 10;",
      explanation: "Consulta pedidos desde el catálogo ERP.",
      assumptions: [],
      model: "qwen2.5-coder:3b"
    });
    const handler = createSqlAssistantHandler({
      generateQuery
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "Muéstrame pedidos"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(generateQuery).toHaveBeenCalledWith({
      question: "Muéstrame pedidos"
    });
  });

  it("returns a human answer when a direct data resolver can answer the request", async () => {
    const generateQuery = vi.fn();
    const handler = createSqlAssistantHandler({
      generateQuery,
      resolveHumanAnswer: vi.fn().mockResolvedValue({
        answer: "En el sistema existen 2 usuarios.",
        evidence: ["Admin <admin@protonlab.cl>", "Vendedor <seller@protonlab.cl>"],
        notice: null,
        sql: "",
        explanation: "Conteo obtenido desde Firebase Auth.",
        assumptions: [],
        model: "firebase-admin"
      })
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "Cuántos usuarios existen en el sistema"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(generateQuery).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        answer: "En el sistema existen 2 usuarios.",
        evidence: ["Admin <admin@protonlab.cl>", "Vendedor <seller@protonlab.cl>"],
        model: "firebase-admin"
      }
    });
  });

  it("answers simple greetings without calling the AI provider", async () => {
    const generateQuery = vi.fn();
    const handler = createSqlAssistantHandler({
      generateQuery,
      resolveHumanAnswer: vi.fn().mockResolvedValue({
        sql: "",
        answer:
          "Hola. Puedes pedirme consultas de solo lectura sobre pedidos, clientes, cotizaciones, inventario, productos o usuarios.",
        explanation: "Saludo respondido sin consultar el proveedor de IA.",
        assumptions: [],
        evidence: [],
        notice: null,
        model: "local-greeting"
      })
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "hola"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(generateQuery).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        answer:
          "Hola. Puedes pedirme consultas de solo lectura sobre pedidos, clientes, cotizaciones, inventario, productos o usuarios.",
        model: "local-greeting"
      }
    });
  });

  it("rejects invalid payloads", async () => {
    const handler = createSqlAssistantHandler({
      authorize: vi.fn().mockResolvedValue(null),
      generateQuery: vi.fn()
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schema: "orders(id, status)"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR"
    });
  });

  it("surfaces AI integration errors with a stable code", async () => {
    const handler = createSqlAssistantHandler({
      authorize: vi.fn().mockResolvedValue(null),
      generateQuery: vi
        .fn()
        .mockRejectedValue(new Error("Falta configurar AI_SQL_API_KEY"))
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "Muéstrame pedidos pendientes",
          schema: "orders(id, status)"
        })
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "AI_UNAVAILABLE"
    });
  });

  it("rejects unauthenticated requests before generating SQL", async () => {
    const handler = createSqlAssistantHandler({
      authorize: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: "Token no proporcionado",
            code: "TOKEN_MISSING",
            details: {
              requestId: "req-auth"
            }
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
              "x-request-id": "req-auth"
            }
          }
        )
      ),
      generateQuery: vi.fn()
    });

    const response = await handler(
      new Request("http://localhost/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question: "Muéstrame pedidos pendientes",
          schema: "orders(id, status)"
        })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "TOKEN_MISSING"
    });
  });
});
