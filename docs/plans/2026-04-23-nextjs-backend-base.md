# Next.js Backend Base Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrar el esqueleto backend actual a una base `Next.js App Router` compatible con Vercel manteniendo la lógica de backend desacoplada en `src/`.

**Architecture:** Next.js proveerá el runtime y las route handlers en `app/api/**/route.ts`, mientras que la lógica reusable de respuestas, health checks y auth seguirá en `src/`. La primera iteración solo cubrirá la configuración del framework, endpoints de salud y una página raíz mínima para validar despliegue.

**Tech Stack:** Next.js 15, React 19, TypeScript, Firebase Admin SDK, Firestore, Vitest, Zod.

---

### Task 1: Configuración base de Next.js

**Files:**
- Modify: `package.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Modify: `tsconfig.json`

**Step 1: Write the failing test**

Crear tests que importen route handlers desde `app/api/**/route.ts` y fallen porque aún no existen.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL por imports faltantes en rutas Next.

**Step 3: Write minimal implementation**

Agregar dependencias y archivos mínimos de Next para que el proyecto compile y pueda correr en Vercel.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS en imports y rutas.

### Task 2: Adaptar health y ready a App Router

**Files:**
- Create: `app/api/health/route.ts`
- Create: `app/api/ready/route.ts`
- Create: `src/server/health.ts`
- Test: `tests/api/next-routes.test.ts`

**Step 1: Write the failing test**

Definir comportamiento esperado para `GET /api/health` y `GET /api/ready` usando `NextRequest`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL por handlers inexistentes o respuesta incompatible.

**Step 3: Write minimal implementation**

Crear handlers Next que reutilicen la capa de respuestas y health checks existentes.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS en códigos, payloads y `x-request-id`.

### Task 3: Mantener compatibilidad backend compartida

**Files:**
- Modify: `src/utils/responses.ts`
- Modify: `src/utils/request.ts`
- Modify: `src/lib/firestore.ts`
- Possibly delete or deprecate: `api/index.ts`

**Step 1: Write the failing test**

Agregar o ajustar tests para el uso compartido de utilidades con `Request` estándar y `NextRequest`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL por tipos o helpers no compatibles.

**Step 3: Write minimal implementation**

Dejar helpers neutrales al framework para facilitar nuevas rutas.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS en toda la suite.
