import { describe, expect, it, vi } from "vitest";

import { createSqlAssistantService } from "../../src/server/sql-assistant";

describe("createSqlAssistantService", () => {
  it("builds a read-only SQL answer from the configured AI model", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sql: "SELECT id, name FROM customers WHERE status = 'activo' ORDER BY name ASC LIMIT 20;",
                  explanation: "Lista clientes activos ordenados por nombre.",
                  assumptions: [
                    "La tabla customers contiene las columnas id, name y status."
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const service = createSqlAssistantService({
      env: {
        AI_SQL_API_KEY: "free-key",
        AI_SQL_MODEL: "openrouter/free-model",
        AI_SQL_API_URL: "https://openrouter.ai/api/v1/chat/completions"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: "Dame los clientes activos ordenados por nombre",
      schema: `
        customers(id, name, status, assigned_sales_rep)
      `
    });

    expect(result).toEqual({
      sql: "SELECT id, name FROM customers WHERE status = 'activo' ORDER BY name ASC LIMIT 20;",
      explanation: "Lista clientes activos ordenados por nombre.",
      assumptions: [
        "La tabla customers contiene las columnas id, name y status."
      ],
      model: "openrouter/free-model"
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer free-key"
        })
      })
    );
  });

  it("rejects non read-only SQL returned by the model", async () => {
    const service = createSqlAssistantService({
      env: {
        AI_SQL_API_KEY: "free-key",
        AI_SQL_MODEL: "openrouter/free-model"
      },
      fetchFn: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sql: "DELETE FROM customers WHERE id = '123';",
                    explanation: "Borra un cliente."
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
    });

    await expect(
      service.generateQuery({
        question: "Elimina el cliente 123",
        schema: "customers(id, name, status)"
      })
    ).rejects.toThrow(/solo lectura/i);
  });

  it("fails when the AI integration is not configured", async () => {
    const service = createSqlAssistantService({
      env: {}
    });

    await expect(
      service.generateQuery({
        question: "Muéstrame pedidos pendientes",
        schema: "orders(id, status)"
      })
    ).rejects.toThrow(/AI_SQL_API_KEY/i);
  });

  it("can use the OpenAI Responses API when OPENAI_API_KEY is configured", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            sql: "SELECT id, total_amount FROM orders ORDER BY created_at DESC LIMIT 5;",
            explanation: "Lista los últimos pedidos por fecha de creación.",
            assumptions: ["orders.created_at existe y representa fecha de creación."]
          })
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const service = createSqlAssistantService({
      env: {
        OPENAI_API_KEY: "openai-key",
        AI_SQL_PROVIDER: "openai",
        AI_SQL_MODEL: "gpt-4o-mini"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: "Últimos 5 pedidos",
      schema: "orders(id, total_amount, created_at)"
    });

    expect(result).toEqual({
      sql: "SELECT id, total_amount FROM orders ORDER BY created_at DESC LIMIT 5;",
      explanation: "Lista los últimos pedidos por fecha de creación.",
      assumptions: ["orders.created_at existe y representa fecha de creación."],
      model: "gpt-4o-mini"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer openai-key"
        })
      })
    );
  });
});
