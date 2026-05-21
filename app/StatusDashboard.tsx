"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { BackendStatus } from "../src/server/status";

type ApiStatusResponse = {
  success: boolean;
  data?: BackendStatus;
};

const initialStatus: BackendStatus = {
  deployment: {
    provider: "vercel",
    environment: "production"
  },
  backend: {
    publicUrl: null,
    correctlyDeployed: false
  },
  frontend: {
    configured: false,
    expectedOrigin: null,
    reachable: false
  },
  integrations: {
    firebaseConfigured: false,
    firestoreReady: false
  },
  summary: {
    level: "warning",
    items: ["Cargando estado operativo desde /api/status."]
  }
};

function renderStateLabel(active: boolean): string {
  return active ? "OK" : "Pendiente";
}

function renderTone(level: string): string {
  if (level === "ok") return "status-pill status-pill--ok";
  if (level === "warning") return "status-pill status-pill--warning";
  return "status-pill status-pill--error";
}

function renderCheck(label: string, active: boolean) {
  return (
    <div className="check-row">
      <span className={active ? "check-dot check-dot--ok" : "check-dot check-dot--pending"} />
      <span>{label}</span>
      <strong>{renderStateLabel(active)}</strong>
    </div>
  );
}

export default function StatusDashboard() {
  const [status, setStatus] = useState<BackendStatus>(initialStatus);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        const payload = (await response.json()) as ApiStatusResponse;

        if (!cancelled && payload.success && payload.data) {
          setStatus(payload.data);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            ...initialStatus,
            summary: {
              level: "error",
              items: ["No fue posible cargar /api/status. Revisa la consola del navegador o los logs de Vercel."]
            }
          });
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="status-hero">
        <div>
          <p className="eyebrow">Panel operativo</p>
          <h1>Protonlab Backend</h1>
          <p className="hero-copy">
            Estado operativo del backend, despliegue en Vercel e integración con frontend/Firebase.
          </p>
        </div>
        <div className={renderTone(status.summary.level)}>
          <span />
          {status.summary.level.toUpperCase()}
        </div>
      </section>

      <section className="summary-panel">
        <div className="section-heading">
          <p>Resumen</p>
          <h2>Nivel actual: {status.summary.level.toUpperCase()}</h2>
        </div>
        <ul className="summary-list">
          {status.summary.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="status-grid">
        <article className="status-card">
          <h2>Despliegue</h2>
          <dl>
            <div>
              <dt>Proveedor</dt>
              <dd>{status.deployment.provider}</dd>
            </div>
            <div>
              <dt>Entorno</dt>
              <dd>{status.deployment.environment}</dd>
            </div>
            <div>
              <dt>URL backend</dt>
              <dd>{status.backend.publicUrl ?? "Detectando..."}</dd>
            </div>
          </dl>
          {renderCheck("Desplegado en Vercel", status.backend.correctlyDeployed)}
        </article>

        <article className="status-card">
          <h2>Frontend</h2>
          <dl>
            <div>
              <dt>Dominio esperado</dt>
              <dd>{status.frontend.expectedOrigin ?? "No configurado"}</dd>
            </div>
          </dl>
          {renderCheck("CORS configurado", status.frontend.configured)}
          {renderCheck("Frontend responde", status.frontend.reachable)}
        </article>

        <article className="status-card">
          <h2>Firebase</h2>
          {renderCheck("Credenciales cargadas", status.integrations.firebaseConfigured)}
          {renderCheck("Firestore operativo", status.integrations.firestoreReady)}
        </article>
      </section>

      <section className="quick-checks">
        <div>
          <p className="eyebrow">Checks rápidos</p>
          <h2>Endpoints de diagnóstico</h2>
        </div>
        <div className="endpoint-list">
          <code>/api/health</code>
          <code>/api/ready</code>
          <code>/api/status</code>
        </div>
        <Link href="/admin" className="admin-link">
          Abrir panel admin del asistente SQL
        </Link>
      </section>
    </>
  );
}
