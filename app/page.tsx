import React from "react";
import { createStatusService } from "../src/server/status";

const statusService = createStatusService();

function renderStateLabel(active: boolean): string {
  return active ? "OK" : "Pendiente";
}

export default async function HomePage() {
  const status = await statusService.getStatus();

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "0 auto", maxWidth: "960px", padding: "40px 24px", color: "#0f172a" }}>
      <h1 style={{ marginBottom: "8px" }}>Protonlab Backend</h1>
      <p style={{ marginTop: 0, marginBottom: "32px", color: "#475569" }}>
        Estado operativo del backend, despliegue en Vercel e integración con frontend/Firebase.
      </p>

      <section style={{ marginBottom: "32px", padding: "20px", border: "1px solid #cbd5e1", borderRadius: "12px", backgroundColor: "#f8fafc" }}>
        <h2 style={{ marginTop: 0 }}>Resumen</h2>
        <p>
          Nivel actual: <strong>{status.summary.level.toUpperCase()}</strong>
        </p>
        <ul>
          {status.summary.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <article style={{ padding: "20px", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Despliegue</h2>
          <p>Proveedor: <strong>{status.deployment.provider}</strong></p>
          <p>Entorno: <strong>{status.deployment.environment}</strong></p>
          <p>URL backend: <strong>{status.backend.publicUrl ?? "No detectada"}</strong></p>
          <p>Desplegado en Vercel: <strong>{renderStateLabel(status.backend.correctlyDeployed)}</strong></p>
        </article>

        <article style={{ padding: "20px", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Frontend</h2>
          <p>Dominio esperado: <strong>{status.frontend.expectedOrigin ?? "No configurado"}</strong></p>
          <p>CORS configurado: <strong>{renderStateLabel(status.frontend.configured)}</strong></p>
          <p>Frontend responde: <strong>{renderStateLabel(status.frontend.reachable)}</strong></p>
        </article>

        <article style={{ padding: "20px", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
          <h2 style={{ marginTop: 0 }}>Firebase</h2>
          <p>Credenciales cargadas: <strong>{renderStateLabel(status.integrations.firebaseConfigured)}</strong></p>
          <p>Firestore operativo: <strong>{renderStateLabel(status.integrations.firestoreReady)}</strong></p>
        </article>
      </section>

      <section style={{ marginTop: "32px", padding: "20px", border: "1px solid #cbd5e1", borderRadius: "12px" }}>
        <h2 style={{ marginTop: 0 }}>Checks rápidos</h2>
        <p><code>/api/health</code> para salud básica.</p>
        <p><code>/api/ready</code> para readiness.</p>
        <p><code>/api/status</code> para estado detallado en JSON.</p>
      </section>
    </main>
  );
}
