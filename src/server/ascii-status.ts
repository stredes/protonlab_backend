import type { BackendStatus } from "./status";

function flag(value: boolean): string {
  return value ? "[OK]" : "[--]";
}

function levelFlag(level: BackendStatus["summary"]["level"]): string {
  if (level === "ok") return "[OK]";
  if (level === "warning") return "[!!]";
  return "[XX]";
}

function line(label: string, value: string | boolean | null): string {
  const rendered = typeof value === "boolean" ? flag(value) : value ?? "not-set";
  return `${label.padEnd(27, ".")} ${rendered}`;
}

export function renderAsciiStatus(status: BackendStatus): string {
  const summary = status.summary.items.map((item) => `  - ${item}`).join("\n");

  return [
    "+------------------------------------------------------------+",
    "|                    PROTONLAB BACKEND                       |",
    "+------------------------------------------------------------+",
    "",
    `${line("status", `${levelFlag(status.summary.level)} ${status.summary.level.toUpperCase()}`)}`,
    `${line("provider", status.deployment.provider)}`,
    `${line("environment", status.deployment.environment)}`,
    `${line("backend url", status.backend.publicUrl)}`,
    `${line("deployed on vercel", status.backend.correctlyDeployed)}`,
    "",
    "+-- FRONTEND ------------------------------------------------+",
    `${line("allowed origin", status.frontend.expectedOrigin)}`,
    `${line("cors configured", status.frontend.configured)}`,
    `${line("frontend reachable", status.frontend.reachable)}`,
    "",
    "+-- FIREBASE ------------------------------------------------+",
    `${line("credentials loaded", status.integrations.firebaseConfigured)}`,
    `${line("firestore ready", status.integrations.firestoreReady)}`,
    "",
    "+-- ENDPOINTS -----------------------------------------------+",
    "GET  /api/health",
    "GET  /api/ready",
    "GET  /api/status",
    "GET  /api/products",
    "POST /api/uploads/product-images",
    "POST /api/ai/sql-assistant",
    "",
    "+-- SUMMARY -------------------------------------------------+",
    summary || "  - No summary items.",
    "",
    "+------------------------------------------------------------+"
  ].join("\n");
}
