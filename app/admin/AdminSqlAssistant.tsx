"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type AssistantResponse = {
  sql: string;
  explanation: string;
  assumptions: string[];
  model: string;
};

const storageKey = "protonlab_admin_firebase_token";
const defaultSchema = [
  "customers(id, name, email, company, status, assigned_sales_rep, created_at)",
  "quotes(id, customer_id, status, total_amount, created_at)",
  "orders(id, customer_id, quote_id, status, total_amount, created_at)",
  "products(id, sku, name, category_id, price, stock, is_active)",
  "inventory_movements(id, product_id, movement_type, quantity, created_at)"
].join("\n");

const cardStyle = {
  border: "1px solid #d6d3d1",
  borderRadius: "16px",
  backgroundColor: "#ffffff",
  boxShadow: "0 18px 40px rgba(28, 25, 23, 0.08)"
} as const;

const fieldStyle = {
  width: "100%",
  border: "1px solid #d6d3d1",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "14px",
  color: "#1c1917",
  backgroundColor: "#fff"
} as const;

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getSessionStorage(): BrowserStorage | null {
  const browserGlobal = globalThis as typeof globalThis & {
    sessionStorage?: BrowserStorage;
  };

  return browserGlobal.sessionStorage ?? null;
}

function readFieldValue(event: unknown): string {
  return (event as { currentTarget: { value: string } }).currentTarget.value;
}

export function AdminSqlAssistant() {
  const [token, setToken] = useState("");
  const [question, setQuestion] = useState(
    "Muéstrame las 10 cotizaciones pendientes más recientes con el nombre del cliente."
  );
  const [schema, setSchema] = useState(defaultSchema);
  const [dialect, setDialect] = useState("PostgreSQL");
  const [businessContext, setBusinessContext] = useState(
    "ERP de Proton Lab para clientes B2B, cotizaciones, pedidos e inventario."
  );
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const sessionStorage = getSessionStorage();
    const savedToken = sessionStorage?.getItem(storageKey);

    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    getSessionStorage()?.setItem(storageKey, token);

    try {
      const response = await fetch("/api/ai/sql-assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          schema,
          dialect,
          businessContext
        })
      });

      const payload = (await response.json()) as
        | { success: true; data: AssistantResponse }
        | { success: false; error: string };

      if (!response.ok || !payload.success) {
        setError(payload.success ? "No fue posible generar la consulta." : payload.error);
        return;
      }

      setResult(payload.data);
    } catch {
      setError("No fue posible conectar con el backend del asistente SQL.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      style={{
        display: "grid",
        gap: "24px",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)"
      }}
    >
      <form onSubmit={handleSubmit} style={{ ...cardStyle, padding: "24px" }}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#1c1917" }}>
            Asistente SQL
          </h2>
          <p style={{ margin: "8px 0 0", color: "#57534e", lineHeight: 1.5 }}>
            Genera consultas de solo lectura para operaciones de Proton Lab usando
            el endpoint protegido del backend.
          </p>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: 600, color: "#292524" }}>Token Firebase</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(readFieldValue(event))}
              placeholder="Bearer token de un usuario interno"
              style={fieldStyle}
              required
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: 600, color: "#292524" }}>Pregunta</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(readFieldValue(event))}
              rows={4}
              style={{ ...fieldStyle, resize: "vertical" }}
              required
            />
          </label>

          <div
            style={{
              display: "grid",
              gap: "14px",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
            }}
          >
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontWeight: 600, color: "#292524" }}>Dialecto</span>
              <input
                value={dialect}
                onChange={(event) => setDialect(readFieldValue(event))}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontWeight: 600, color: "#292524" }}>Contexto</span>
              <input
                value={businessContext}
                onChange={(event) => setBusinessContext(readFieldValue(event))}
                style={fieldStyle}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontWeight: 600, color: "#292524" }}>Esquema disponible</span>
            <textarea
              value={schema}
              onChange={(event) => setSchema(readFieldValue(event))}
              rows={12}
              style={{
                ...fieldStyle,
                resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
              }}
              required
            />
          </label>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <p style={{ margin: 0, color: "#78716c", fontSize: "0.95rem" }}>
            El token se guarda solo en `sessionStorage` del navegador actual.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              border: 0,
              borderRadius: "999px",
              backgroundColor: isSubmitting ? "#a8a29e" : "#0f766e",
              color: "#f8fafc",
              padding: "12px 18px",
              fontWeight: 700,
              cursor: isSubmitting ? "progress" : "pointer"
            }}
          >
            {isSubmitting ? "Generando..." : "Generar SQL"}
          </button>
        </div>
      </form>

      <aside style={{ display: "grid", gap: "20px" }}>
        <section style={{ ...cardStyle, padding: "24px", backgroundColor: "#fafaf9" }}>
          <h3 style={{ marginTop: 0, color: "#1c1917" }}>Uso recomendado</h3>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "#57534e", lineHeight: 1.6 }}>
            <li>Usa un esquema corto y realista, no toda la base.</li>
            <li>Pide agregaciones, filtros y joins de forma explícita.</li>
            <li>Revisa los supuestos antes de ejecutar la query en producción.</li>
          </ul>
        </section>

        <section style={{ ...cardStyle, padding: "24px", minHeight: "320px" }}>
          <h3 style={{ marginTop: 0, color: "#1c1917" }}>Resultado</h3>

          {error ? (
            <p style={{ color: "#b91c1c", lineHeight: 1.5 }}>{error}</p>
          ) : null}

          {!error && !result ? (
            <p style={{ color: "#57534e", lineHeight: 1.5 }}>
              Aquí aparecerán la consulta SQL, la explicación y los supuestos del
              modelo cuando envíes una solicitud.
            </p>
          ) : null}

          {result ? (
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#292524" }}>
                  SQL
                </p>
                <pre
                  style={{
                    margin: 0,
                    padding: "16px",
                    borderRadius: "14px",
                    backgroundColor: "#1c1917",
                    color: "#f5f5f4",
                    overflowX: "auto",
                    fontSize: "13px"
                  }}
                >
                  <code>{result.sql}</code>
                </pre>
              </div>

              <div>
                <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#292524" }}>
                  Explicación
                </p>
                <p style={{ margin: 0, color: "#44403c", lineHeight: 1.6 }}>
                  {result.explanation}
                </p>
              </div>

              <div>
                <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#292524" }}>
                  Supuestos
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", color: "#57534e", lineHeight: 1.6 }}>
                  {result.assumptions.length > 0 ? (
                    result.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))
                  ) : (
                    <li>Sin supuestos declarados por el modelo.</li>
                  )}
                </ul>
              </div>

              <p style={{ margin: 0, color: "#78716c", fontSize: "0.92rem" }}>
                Modelo: <strong>{result.model}</strong>
              </p>
            </div>
          ) : null}
        </section>
      </aside>
    </section>
  );
}
