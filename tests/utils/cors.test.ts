import { afterEach, describe, expect, it } from "vitest";
import { createPreflightResponse } from "../../src/utils/cors";

const originalAllowedOrigins = process.env.PROTONLAB_ALLOWED_ORIGINS;

afterEach(() => {
  process.env.PROTONLAB_ALLOWED_ORIGINS = originalAllowedOrigins;
});

function preflightFor(origin: string): Response {
  return createPreflightResponse(
    new Request("https://protonlab-backend-kappa.vercel.app/api/products", {
      headers: { origin }
    }),
    ["GET", "OPTIONS"]
  );
}

describe("CORS", () => {
  it("echoes the production frontend origin when it is configured", () => {
    process.env.PROTONLAB_ALLOWED_ORIGINS =
      "https://front-protonlab.vercel.app";

    const response = preflightFor("https://front-protonlab.vercel.app");

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://front-protonlab.vercel.app"
    );
  });

  it("allows Vercel preview deployments for the frontend project", () => {
    process.env.PROTONLAB_ALLOWED_ORIGINS =
      "https://front-protonlab.vercel.app";

    const previewOrigin =
      "https://front-protonlab-qymek9h-gianlucassannmartin-gmailcoms-projects.vercel.app";
    const response = preflightFor(previewOrigin);

    expect(response.headers.get("access-control-allow-origin")).toBe(
      previewOrigin
    );
  });

  it("does not echo unrelated Vercel deployments", () => {
    process.env.PROTONLAB_ALLOWED_ORIGINS =
      "https://front-protonlab.vercel.app";

    const response = preflightFor("https://other-project.vercel.app");

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://front-protonlab.vercel.app"
    );
  });
});
