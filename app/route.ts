import { createStatusService, type BackendStatus } from "../src/server/status";

const statusService = createStatusService();

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stateLabel(active: boolean): string {
  return active ? "OK" : "Pendiente";
}

function dotClass(active: boolean): string {
  return active ? "ok" : "pending";
}

function toneClass(level: BackendStatus["summary"]["level"]): string {
  if (level === "ok") return "ok";
  if (level === "warning") return "warning";
  return "error";
}

function checkRow(label: string, active: boolean): string {
  return `
    <div class="check-row">
      <span class="dot ${dotClass(active)}"></span>
      <span>${escapeHtml(label)}</span>
      <strong>${stateLabel(active)}</strong>
    </div>
  `;
}

function renderStatusHtml(status: BackendStatus): string {
  const summaryItems = status.summary.items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Protonlab Backend</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --panel: #fffdf8;
      --ink: #18202f;
      --muted: #667085;
      --line: #d7d0c4;
      --accent: #0f766e;
      --accent-strong: #115e59;
      --shadow: 0 22px 70px rgba(24, 32, 47, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(15, 118, 110, 0.12), transparent 34%),
        radial-gradient(circle at 90% 8%, rgba(180, 83, 9, 0.12), transparent 28%),
        var(--bg);
      font-family: "Aptos", "Segoe UI", sans-serif;
    }
    a { color: inherit; }
    main {
      width: min(1120px, calc(100% - 32px));
      min-height: 100vh;
      margin: 0 auto;
      padding: 48px 0;
    }
    .hero {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      padding: 32px;
      color: #f8fafc;
      background:
        linear-gradient(140deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.9)),
        repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 84px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .eyebrow {
      margin: 0 0 10px;
      color: #5eead4;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(2.3rem, 6vw, 5.3rem);
      line-height: 0.95;
      letter-spacing: 0;
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .copy {
      max-width: 660px;
      margin: 18px 0 0;
      color: #cbd5e1;
      font-size: 1.03rem;
      line-height: 1.6;
    }
    .pill {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0.08em;
    }
    .pill span,
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
    }
    .ok { background: #22c55e; box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.16); }
    .warning { background: #f59e0b; box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.16); }
    .error,
    .pending { background: #ef4444; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.16); }
    .summary,
    .card,
    .checks {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 253, 248, 0.9);
      box-shadow: 0 10px 34px rgba(24, 32, 47, 0.08);
      backdrop-filter: blur(14px);
    }
    .summary {
      display: grid;
      grid-template-columns: minmax(220px, 0.38fr) 1fr;
      gap: 28px;
      margin-top: 22px;
      padding: 24px;
    }
    .section-title p {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    ul {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      padding-left: 20px;
      color: var(--muted);
      line-height: 1.55;
    }
    li::before {
      position: absolute;
      top: 0.72em;
      left: 0;
      width: 8px;
      height: 2px;
      background: var(--accent);
      content: "";
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .card {
      display: grid;
      align-content: start;
      gap: 16px;
      min-height: 230px;
      padding: 22px;
    }
    dl {
      display: grid;
      gap: 14px;
      margin: 0;
    }
    dt {
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    dd {
      margin: 4px 0 0;
      font-weight: 750;
      overflow-wrap: anywhere;
    }
    .check-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.95rem;
    }
    .check-row strong { color: var(--ink); }
    .checks {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      margin-top: 16px;
      padding: 24px;
    }
    .checks .eyebrow { color: var(--accent); }
    .endpoint-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      grid-column: 1 / -1;
    }
    code {
      padding: 8px 10px;
      border: 1px solid #c8c0b4;
      border-radius: 6px;
      background: #ece7dc;
      color: #293241;
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      font-size: 0.88rem;
    }
    .admin-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border: 1px solid var(--accent-strong);
      border-radius: 6px;
      color: #ffffff;
      background: var(--accent);
      font-weight: 800;
      text-decoration: none;
    }
    @media (max-width: 860px) {
      .hero, .summary, .checks { grid-template-columns: 1fr; }
      .hero { display: grid; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <p class="eyebrow">Panel operativo</p>
        <h1>Protonlab Backend</h1>
        <p class="copy">Estado operativo del backend, despliegue en Vercel e integración con frontend/Firebase.</p>
      </div>
      <div class="pill"><span class="${toneClass(status.summary.level)}"></span>${status.summary.level.toUpperCase()}</div>
    </section>

    <section class="summary">
      <div class="section-title">
        <p>Resumen</p>
        <h2>Nivel actual: ${status.summary.level.toUpperCase()}</h2>
      </div>
      <ul>${summaryItems}</ul>
    </section>

    <section class="grid">
      <article class="card">
        <h2>Despliegue</h2>
        <dl>
          <div><dt>Proveedor</dt><dd>${escapeHtml(status.deployment.provider)}</dd></div>
          <div><dt>Entorno</dt><dd>${escapeHtml(status.deployment.environment)}</dd></div>
          <div><dt>URL backend</dt><dd>${escapeHtml(status.backend.publicUrl ?? "No detectada")}</dd></div>
        </dl>
        ${checkRow("Desplegado en Vercel", status.backend.correctlyDeployed)}
      </article>

      <article class="card">
        <h2>Frontend</h2>
        <dl>
          <div><dt>Dominio esperado</dt><dd>${escapeHtml(status.frontend.expectedOrigin ?? "No configurado")}</dd></div>
        </dl>
        ${checkRow("CORS configurado", status.frontend.configured)}
        ${checkRow("Frontend responde", status.frontend.reachable)}
      </article>

      <article class="card">
        <h2>Firebase</h2>
        ${checkRow("Credenciales cargadas", status.integrations.firebaseConfigured)}
        ${checkRow("Firestore operativo", status.integrations.firestoreReady)}
      </article>
    </section>

    <section class="checks">
      <div>
        <p class="eyebrow">Checks rápidos</p>
        <h2>Endpoints de diagnóstico</h2>
      </div>
      <div class="endpoint-list">
        <code>/api/health</code>
        <code>/api/ready</code>
        <code>/api/status</code>
      </div>
      <a class="admin-link" href="/admin">Abrir panel admin del asistente SQL</a>
    </section>
  </main>
</body>
</html>`;
}

export async function GET(): Promise<Response> {
  const status = await statusService.getStatus();

  return new Response(renderStatusHtml(status), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0"
    }
  });
}
