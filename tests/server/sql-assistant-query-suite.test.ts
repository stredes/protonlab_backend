import { describe, expect, it, vi } from "vitest";

import { createSqlAssistantService } from "../../src/server/sql-assistant";

type SqlSuiteCase = {
  id: string;
  question: string;
  domain: "pedidos" | "cotizaciones" | "facturacion" | "soporte" | "catalogo" | "clientes";
  schema?: string;
  expected: {
    sql: string;
    answer: string;
    explanation: string;
    assumptions: string[];
    evidence: string[];
    notice: string | null;
  };
};

const forbiddenSql = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|exec)\b/i;

const querySuite: SqlSuiteCase[] = [
  {
    id: "orders-by-status",
    domain: "pedidos",
    question: "Cuantos pedidos hay por estado operativo",
    expected: {
      sql: "SELECT status, COUNT(*) AS total FROM orders GROUP BY status ORDER BY total DESC LIMIT 20;",
      answer: "El sistema agrupa los pedidos por estado y muestra cuántos existen en cada etapa operativa.",
      explanation: "Cuenta pedidos agrupados por status para validar carga de trabajo comercial y bodega.",
      assumptions: ["orders.status representa el estado operativo del pedido."],
      evidence: ["status", "total"],
      notice: null
    }
  },
  {
    id: "pending-payment-orders",
    domain: "facturacion",
    question: "Muestra ordenes con pago pendiente y total mayor a cero",
    expected: {
      sql: "SELECT orderNumber, customerName, organization, total, paymentStatus FROM orders WHERE paymentStatus = 'pendiente' AND total > 0 ORDER BY total DESC LIMIT 20;",
      answer: "La consulta lista pedidos con pago pendiente priorizados por monto.",
      explanation: "Filtra pedidos no pagados y los ordena por total para seguimiento financiero.",
      assumptions: ["orders.paymentStatus usa el valor pendiente para pagos no cerrados."],
      evidence: ["orderNumber", "customerName", "total"],
      notice: null
    }
  },
  {
    id: "monthly-sales",
    domain: "pedidos",
    question: "Ventas confirmadas del mes por estado",
    expected: {
      sql: "SELECT DATE_TRUNC('month', createdAt) AS month, status, SUM(total) AS total_sales, COUNT(*) AS orders_count FROM orders WHERE status IN ('confirmado', 'procesando', 'enviado', 'entregado') GROUP BY month, status ORDER BY month DESC, total_sales DESC LIMIT 24;",
      answer: "La consulta resume ventas operativas mensuales por estado de pedido.",
      explanation: "Suma totales de pedidos confirmados o posteriores para medir venta real del periodo.",
      assumptions: ["createdAt representa la fecha de creación del pedido.", "total representa el monto total del pedido."],
      evidence: ["month", "status", "total_sales"],
      notice: null
    }
  },
  {
    id: "pending-quotes",
    domain: "cotizaciones",
    question: "Cotizaciones pendientes de aprobacion por vendedor",
    expected: {
      sql: "SELECT assignedSalesRep, status, COUNT(*) AS total_quotes, SUM(total) AS quoted_amount FROM quotes WHERE status IN ('pendiente', 'en_revision_vendedor', 'aprobado_vendedor', 'en_revision_admin') GROUP BY assignedSalesRep, status ORDER BY quoted_amount DESC LIMIT 20;",
      answer: "La consulta muestra cotizaciones activas por vendedor, estado y monto cotizado.",
      explanation: "Agrupa cotizaciones que aún no están cerradas, rechazadas ni convertidas.",
      assumptions: ["quotes.assignedSalesRep identifica al vendedor asignado.", "quotes.total es el monto cotizado."],
      evidence: ["assignedSalesRep", "status", "quoted_amount"],
      notice: null
    }
  },
  {
    id: "quote-conversion-rate",
    domain: "cotizaciones",
    question: "Tasa de conversion de cotizaciones a pedido",
    expected: {
      sql: "SELECT COUNT(*) AS total_quotes, COUNT(*) FILTER (WHERE status = 'convertida') AS converted_quotes, ROUND((COUNT(*) FILTER (WHERE status = 'convertida')::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS conversion_rate FROM quotes;",
      answer: "La consulta calcula el porcentaje de cotizaciones convertidas frente al total.",
      explanation: "Usa status convertida como señal de conversión comercial.",
      assumptions: ["quotes.status = 'convertida' indica que la cotización generó pedido."],
      evidence: ["total_quotes", "converted_quotes", "conversion_rate"],
      notice: null
    }
  },
  {
    id: "support-priority",
    domain: "soporte",
    question: "Tickets de soporte por prioridad y estado",
    expected: {
      sql: "SELECT priority, status, COUNT(*) AS total_tickets FROM supportTickets GROUP BY priority, status ORDER BY priority ASC, total_tickets DESC LIMIT 20;",
      answer: "La consulta agrupa tickets por prioridad y estado para revisar carga de soporte.",
      explanation: "Cuenta tickets combinando severidad y avance operativo.",
      assumptions: ["supportTickets.priority y supportTickets.status contienen los estados normalizados del soporte."],
      evidence: ["priority", "status", "total_tickets"],
      notice: null
    }
  },
  {
    id: "products-without-image",
    domain: "catalogo",
    question: "Productos sin imagen principal en blob",
    expected: {
      sql: "SELECT p.id, p.sku, p.name FROM products p LEFT JOIN productImages pi ON pi.productId = p.id AND pi.variant = 'primary' WHERE pi.productId IS NULL ORDER BY p.name ASC LIMIT 50;",
      answer: "La consulta identifica productos que no tienen imagen primaria asociada.",
      explanation: "Cruza catálogo con productImages para detectar brechas de contenido visual.",
      assumptions: ["productImages.variant = 'primary' representa la imagen principal del producto."],
      evidence: ["id", "sku", "name"],
      notice: null
    }
  },
  {
    id: "low-stock-products",
    domain: "catalogo",
    question: "Productos con stock bajo menor a cinco unidades",
    expected: {
      sql: "SELECT id, sku, name, stock FROM products WHERE stock < 5 ORDER BY stock ASC, name ASC LIMIT 50;",
      answer: "La consulta lista productos con stock bajo para reposición.",
      explanation: "Filtra productos bajo el umbral operativo de cinco unidades.",
      assumptions: ["products.stock representa stock disponible si el origen lo expone."],
      evidence: ["sku", "name", "stock"],
      notice: null
    }
  },
  {
    id: "top-customers",
    domain: "clientes",
    question: "Top clientes por monto total comprado",
    expected: {
      sql: "SELECT customerEmail, customerName, organization, SUM(total) AS total_purchased, COUNT(*) AS orders_count FROM orders WHERE status IN ('confirmado', 'procesando', 'enviado', 'entregado') GROUP BY customerEmail, customerName, organization ORDER BY total_purchased DESC LIMIT 10;",
      answer: "La consulta muestra los clientes con mayor monto comprado en pedidos operativos.",
      explanation: "Agrupa pedidos confirmados o posteriores por cliente y suma su total.",
      assumptions: ["customerEmail identifica al cliente de forma estable.", "Pedidos cancelados o rechazados no cuentan como compra."],
      evidence: ["customerEmail", "total_purchased", "orders_count"],
      notice: null
    }
  },
  {
    id: "warehouse-ready-orders",
    domain: "pedidos",
    question: "Pedidos que bodega debe preparar o despachar",
    expected: {
      sql: "SELECT orderNumber, customerName, organization, status, paymentStatus, updatedAt FROM orders WHERE status IN ('confirmado', 'procesando') ORDER BY updatedAt ASC LIMIT 30;",
      answer: "La consulta lista pedidos que deben avanzar por preparación o despacho en bodega.",
      explanation: "Usa estados confirmado y procesando como bandeja operativa de bodega.",
      assumptions: ["Bodega prepara pedidos confirmados y despacha pedidos en procesamiento."],
      evidence: ["orderNumber", "status", "updatedAt"],
      notice: null
    }
  }
];

function createModelResponse(expected: SqlSuiteCase["expected"]) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(expected)
        }
      }
    ]
  };
}

function extractQuestionFromPrompt(body: string): string {
  const parsed = JSON.parse(body) as {
    messages: Array<{ role: string; content: string }>;
  };
  const userPrompt = parsed.messages.find((message) => message.role === "user")?.content ?? "";
  return userPrompt.match(/Pregunta del usuario: (.+)/)?.[1]?.trim() ?? "";
}

describe("SQL assistant query suite", () => {
  it.each(querySuite)("$id interpreta la pregunta y genera SQL read-only correcto", async (testCase) => {
    const fetchFn = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const question = extractQuestionFromPrompt(String(init.body));
      const matched = querySuite.find((item) => item.question === question);

      if (!matched) {
        return new Response(JSON.stringify({ error: `Pregunta no cubierta: ${question}` }), { status: 500 });
      }

      return new Response(JSON.stringify(createModelResponse(matched.expected)), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const service = createSqlAssistantService({
      env: {
        AI_SQL_PROVIDER: "openrouter",
        AI_SQL_API_KEY: "suite-key",
        AI_SQL_MODEL: "suite-model"
      },
      fetchFn
    });

    const result = await service.generateQuery({
      question: testCase.question,
      schema: testCase.schema,
      businessContext: `Validacion automatizada del dominio ${testCase.domain}.`
    });

    expect(result).toMatchObject({
      ...testCase.expected,
      model: "suite-model"
    });
    expect(result.sql).toMatch(/^(SELECT|WITH)\b/i);
    expect(result.sql.trim()).toMatch(/;$/);
    expect(result.sql.replace(/;\s*$/, "")).not.toContain(";");
    expect(result.sql).not.toMatch(forbiddenSql);
    expect(result.answer.length).toBeGreaterThan(20);
    expect(result.explanation.length).toBeGreaterThan(20);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("inyecta el proceso de interpretacion completo en el prompt enviado al modelo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createModelResponse(querySuite[0].expected)), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const service = createSqlAssistantService({
      env: {
        AI_SQL_PROVIDER: "openrouter",
        AI_SQL_API_KEY: "suite-key",
        AI_SQL_MODEL: "suite-model"
      },
      fetchFn
    });

    await service.generateQuery({
      question: querySuite[0].question,
      dialect: "PostgreSQL",
      businessContext: "ERP ProtonLab con ventas, cotizaciones, bodega, soporte y facturacion."
    });

    const requestBody = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = requestBody.messages.find((message) => message.role === "system")?.content;
    const userPrompt = requestBody.messages.find((message) => message.role === "user")?.content;

    expect(systemPrompt).toContain("Genera exclusivamente consultas PostgreSQL de solo lectura");
    expect(systemPrompt).toContain("Responde solo JSON válido");
    expect(systemPrompt).toContain("answer debe ser una respuesta breve en lenguaje humano");
    expect(userPrompt).toContain("Pregunta del usuario: Cuantos pedidos hay por estado operativo");
    expect(userPrompt).toContain("Contexto de negocio: ERP ProtonLab");
    expect(userPrompt).toContain("Catálogo operativo ProtonLab");
    expect(userPrompt).toContain("orders");
    expect(userPrompt).toContain("quotes");
    expect(userPrompt).toContain("supportTickets");
    expect(userPrompt).toContain("productImages");
    expect(userPrompt).toContain("Reglas de acceso por rol");
  });

  it("rechaza una respuesta del modelo que intenta mezclar lectura con escritura", async () => {
    const service = createSqlAssistantService({
      env: {
        AI_SQL_PROVIDER: "openrouter",
        AI_SQL_API_KEY: "suite-key",
        AI_SQL_MODEL: "suite-model"
      },
      fetchFn: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify(
            createModelResponse({
              sql: "SELECT * FROM orders; DROP TABLE orders;",
              answer: "Consulta insegura.",
              explanation: "Esto no debe pasar.",
              assumptions: [],
              evidence: [],
              notice: null
            })
          ),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    });

    await expect(
      service.generateQuery({
        question: "dame pedidos y limpia la tabla"
      })
    ).rejects.toThrow(/múltiples sentencias|solo lectura/i);
  });
});
