#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function normalizeBaseUrl(raw) {
  if (!raw) return "";
  return String(raw).trim().replace(/\/+$/, "");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const rawValue = rawValueParts.join("=").trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (!(key in process.env)) {
      process.env[key] = unquoted;
    }
  }
}

const cwd = process.cwd();
loadEnvFile(path.join(cwd, ".env"));
loadEnvFile(path.join(cwd, ".env.local"));

const backendBaseUrl = normalizeBaseUrl(
  process.env.BACKEND_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000"
);

const frontendOrigin = normalizeBaseUrl(
  process.env.FRONTEND_ORIGIN ||
    process.env.PROTONLAB_ALLOWED_ORIGINS?.split(",")[0] ||
    "http://localhost:5173"
);

const bearerToken = process.env.SMOKE_BEARER_TOKEN;

if (!backendBaseUrl) {
  console.error("BACKEND_BASE_URL no definida.");
  process.exit(1);
}

if (!frontendOrigin) {
  console.error("FRONTEND_ORIGIN no definida.");
  process.exit(1);
}

let failed = false;

console.log(
  `Smoke backend/frontend connection against backend=${backendBaseUrl} frontend=${frontendOrigin}`
);

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function runCheck(name, run) {
  try {
    const ok = await run();
    console.log(`${ok ? "OK" : "FAIL"} ${name}`);
    if (!ok) {
      failed = true;
    }
  } catch (error) {
    failed = true;
    console.log(
      `FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

await runCheck("frontend_reachable", async () => {
  const response = await fetch(frontendOrigin, { method: "GET" });
  return response.ok;
});

await runCheck("backend_health", async () => {
  const response = await fetch(`${backendBaseUrl}/api/health`, {
    method: "GET",
    headers: {
      Origin: frontendOrigin
    }
  });
  return response.status === 200;
});

await runCheck("backend_status", async () => {
  const response = await fetch(`${backendBaseUrl}/api/status`, {
    method: "GET",
    headers: {
      Origin: frontendOrigin
    }
  });
  const payload = await parseResponseBody(response);
  return (
    response.status === 200 &&
    payload &&
    payload.success === true &&
    payload.data &&
    payload.data.frontend &&
    payload.data.frontend.expectedOrigin === frontendOrigin
  );
});

await runCheck("catalog_cors", async () => {
  const response = await fetch(`${backendBaseUrl}/api/products`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendOrigin,
      "Access-Control-Request-Method": "GET"
    }
  });

  return (
    response.status === 204 &&
    response.headers.get("access-control-allow-origin") === frontendOrigin
  );
});

await runCheck("assistant_cors", async () => {
  const response = await fetch(`${backendBaseUrl}/api/ai/sql-assistant`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Authorization"
    }
  });

  return (
    response.status === 204 &&
    response.headers.get("access-control-allow-origin") === frontendOrigin &&
    (response.headers.get("access-control-allow-methods") || "").includes("POST")
  );
});

await runCheck("assistant_auth_gate", async () => {
  const response = await fetch(`${backendBaseUrl}/api/ai/sql-assistant`, {
    method: "POST",
    headers: {
      Origin: frontendOrigin,
      "Content-Type": "application/json",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
    },
    body: JSON.stringify({
      question: "Muéstrame 5 pedidos pendientes",
      schema: "orders(id, status, customer_id, created_at)",
      dialect: "PostgreSQL",
      businessContext: "ERP Proton Lab para pedidos y clientes."
    })
  });

  const payload = await parseResponseBody(response);

  if (!bearerToken) {
    return response.status === 401 && payload && payload.code === "TOKEN_MISSING";
  }

  return (
    (response.status === 200 && payload && payload.success === true) ||
    (response.status === 503 && payload && payload.code === "AI_UNAVAILABLE")
  );
});

if (failed) {
  process.exit(1);
}

console.log("Backend/frontend smoke connection passed.");
