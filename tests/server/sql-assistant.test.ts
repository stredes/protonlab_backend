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
                  answer: "Encontré clientes activos ordenados por nombre.",
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

    expect(result).toMatchObject({
      sql: "SELECT id, name FROM customers WHERE status = 'activo' ORDER BY name ASC LIMIT 20;",
      explanation: "Lista clientes activos ordenados por nombre.",
      answer: "Encontré clientes activos ordenados por nombre.",
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

  it("injects the ProtonLab ERP context registry into the model prompt", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status;",
                  explanation: "Cuenta pedidos por estado.",
                  assumptions: []
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
        AI_SQL_MODEL: "openrouter/free-model"
      },
      fetchFn
    });

    await service.generateQuery({
      question: "Cuenta pedidos por estado",
      schema: "orders(id, status)"
    });

    const requestBody = JSON.parse(
      fetchFn.mock.calls[0]?.[1]?.body as string
    ) as {
      messages: Array<{
        role: string;
        content: string;
      }>;
    };
    const userPrompt = requestBody.messages.find(
      (message) => message.role === "user"
    )?.content;

    expect(userPrompt).toContain("Catálogo operativo ProtonLab");
    expect(userPrompt).toContain("orders");
    expect(userPrompt).toContain("quotes");
    expect(userPrompt).toContain("productImages");
    expect(userPrompt).toContain("Reglas de acceso por rol");
  });

  it("can generate SQL using only the built-in context registry", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sql: "SELECT id, status FROM orders LIMIT 20;",
                  explanation: "Lista pedidos usando el catálogo ERP.",
                  assumptions: []
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
        AI_SQL_MODEL: "openrouter/free-model"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: "Muéstrame pedidos"
    });

    expect(result.sql).toBe("SELECT id, status FROM orders LIMIT 20;");
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

    expect(result).toMatchObject({
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

  it("can use the Gemini generateContent API when GEMINI_API_KEY is configured", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status LIMIT 5;",
                      explanation: "Cuenta pedidos agrupados por estado.",
                      assumptions: ["orders.status existe y representa el estado del pedido."]
                    })
                  }
                ]
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
        GEMINI_API_KEY: "gemini-key",
        AI_SQL_PROVIDER: "gemini",
        AI_SQL_MODEL: "gemini-2.0-flash"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: "Cuenta pedidos por estado",
      schema: "orders(id, status)"
    });

    expect(result).toMatchObject({
      sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status LIMIT 5;",
      explanation: "Cuenta pedidos agrupados por estado.",
      assumptions: ["orders.status existe y representa el estado del pedido."],
      model: "gemini-2.0-flash"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-goog-api-key": "gemini-key"
        })
      })
    );
  });

  it("can use an Ollama-compatible gateway when OLLAMA_API_URL is configured", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status LIMIT 5;",
              explanation: "Cuenta pedidos agrupados por estado usando Ollama.",
              assumptions: ["orders.status existe."]
            })
          }
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
        AI_SQL_PROVIDER: "ollama",
        AI_SQL_MODEL: "llama3.1:8b",
        OLLAMA_API_URL: "https://ollama-gateway.example.com",
        OLLAMA_API_KEY: "gateway-key"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: "Cuenta pedidos por estado",
      schema: "orders(id, status)"
    });

    expect(result).toMatchObject({
      sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status LIMIT 5;",
      explanation: "Cuenta pedidos agrupados por estado usando Ollama.",
      assumptions: ["orders.status existe."],
      model: "llama3.1:8b"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://ollama-gateway.example.com/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer gateway-key"
        }),
        body: expect.stringContaining('"stream":false')
      })
    );
  });
});
