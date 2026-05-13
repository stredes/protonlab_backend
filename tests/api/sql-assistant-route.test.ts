import { describe, expect, it, vi } from "vitest";

import { createSqlAssistantHandler } from "../../src/server/sql-assistant";

describe("sql assistant route handler", () => {
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
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        sql: "SELECT * FROM orders WHERE status = 'pendiente' LIMIT 10;",
        explanation: "Devuelve pedidos pendientes.",
        assumptions: ["La tabla orders contiene la columna status."],
        model: "openrouter/free-model"
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
