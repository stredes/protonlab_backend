import React from "react";
import Link from "next/link";

import { AdminSqlAssistant } from "./AdminSqlAssistant";

export default function AdminPage() {
  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "1240px",
        padding: "40px 24px 72px",
        color: "#1c1917",
        fontFamily: "Arial, sans-serif",
        background:
          "linear-gradient(180deg, #f5f5f4 0%, #fffbeb 42%, #ffffff 100%)"
      }}
    >
      <div style={{ marginBottom: "28px" }}>
        <Link href="/" style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}>
          ← Volver al estado del backend
        </Link>
        <p
          style={{
            margin: "18px 0 8px",
            color: "#b45309",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "0.78rem"
          }}
        >
          Admin Workspace
        </p>
        <h1 style={{ margin: 0, fontSize: "2.4rem", lineHeight: 1.05 }}>
          Asistente IA para consultas SQL
        </h1>
        <p style={{ margin: "14px 0 0", maxWidth: "760px", color: "#57534e", lineHeight: 1.6 }}>
          Panel interno para redactar preguntas operativas, adjuntar el esquema
          relevante y obtener SQL de solo lectura desde el asistente del backend.
        </p>
      </div>

      <AdminSqlAssistant />
    </main>
  );
}
