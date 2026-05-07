#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "package.json no encontrado. Ejecuta este script desde el repo correcto."
  exit 1
fi

commit_group() {
  local title="$1"
  local body="$2"
  shift 2

  git add -- "$@"

  if git diff --cached --quiet -- "$@"; then
    echo "Sin cambios para: $title"
    return 0
  fi

  git commit -m "$title" -m "$body"
}

echo "Verificando estado del proyecto antes de commitear..."
npm test
npm run build

commit_group \
  "docs(spec): add backend guidelines and next migration plan" \
  "Add the backend technical guidelines in markdown and document the Next.js App Router migration plan for the Vercel deployment baseline." \
  "docs/Lineamientos_Tecnicos_Backend_Proton_Lab.md" \
  "docs/plans/2026-04-23-nextjs-backend-base.md"

commit_group \
  "feat(next): bootstrap app router runtime for vercel" \
  "Configure Next.js, React and TypeScript for Vercel deployment, add the root layout and landing page, and ignore local build artifacts." \
  ".gitignore" \
  "package.json" \
  "package-lock.json" \
  "tsconfig.json" \
  "next.config.ts" \
  "next-env.d.ts" \
  "app/layout.tsx" \
  "app/page.tsx" \
  "tests/app/page.test.ts"

commit_group \
  "feat(api): add next health and readiness endpoints" \
  "Expose the initial health and readiness checks through App Router handlers while keeping the shared backend logic under src/server." \
  "app/api/health/route.ts" \
  "app/api/ready/route.ts" \
  "src/server/health.ts" \
  "tests/api/next-routes.test.ts"

commit_group \
  "refactor(core): align shared request helpers with next handlers" \
  "Make the shared response and request utilities compatible with Next.js route handlers and update the existing backend tests and imports accordingly." \
  "api/index.ts" \
  "src/middleware/auth.ts" \
  "src/utils/request.ts" \
  "src/utils/responses.ts" \
  "tests/api/index.test.ts" \
  "tests/http/responses.test.ts" \
  "tests/middleware/auth.test.ts"

echo
echo "Commits generados. Revisa el resultado con:"
echo "  git log --oneline --decorate -n 6"
