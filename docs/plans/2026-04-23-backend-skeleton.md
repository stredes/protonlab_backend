# Backend Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Levantar un esqueleto mínimo del backend Proton Lab con Vercel Functions, TypeScript, validación estructural y endpoints base verificables.

**Architecture:** Se implementará una API serverless con un router central en `api/index.ts`, capas compartidas en `src/` y respuestas HTTP estandarizadas. La primera iteración solo dejará infraestructura base, autenticación preparada y checks de salud sin entrar todavía en módulos de negocio.

**Tech Stack:** Node.js 20+, TypeScript, Vercel Functions, Vitest, Zod, Firebase Admin SDK, Firestore.

---

### Task 1: Configuración base del proyecto

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Write the failing test**

Crear un test que importe el router principal y falle porque aún no existe.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL con error de importación del router.

**Step 3: Write minimal implementation**

Agregar scripts, configuración TypeScript y Vitest.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: El runner ejecuta la suite y ya no falla por configuración ausente.

### Task 2: Respuestas HTTP y request id

**Files:**
- Create: `src/utils/responses.ts`
- Create: `src/utils/request.ts`
- Test: `tests/http/responses.test.ts`

**Step 1: Write the failing test**

Definir tests para `ok`, `fail` y generación de `x-request-id`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque los módulos no existen.

**Step 3: Write minimal implementation**

Implementar helpers para respuestas JSON consistentes y trazabilidad.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS en la suite HTTP.

### Task 3: Router principal y checks de salud

**Files:**
- Create: `api/index.ts`
- Create: `src/lib/firestore.ts`
- Test: `tests/api/index.test.ts`

**Step 1: Write the failing test**

Definir tests para `GET /api/health`, `GET /api/ready` y `404`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque no existe el router.

**Step 3: Write minimal implementation**

Crear el handler principal con dispatch básico y estado de Firestore configurable.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS para routing, payloads y códigos de estado.

### Task 4: Auth y roles preparados

**Files:**
- Create: `src/models/user.ts`
- Create: `src/middleware/auth.ts`
- Test: `tests/middleware/auth.test.ts`

**Step 1: Write the failing test**

Definir tests para ausencia de token, usuario autenticado y restricción por rol.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque faltan middleware y tipos.

**Step 3: Write minimal implementation**

Agregar middleware composable para autenticación y autorización, con proveedor de verificación inyectable para pruebas.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS con validación de errores `TOKEN_MISSING` y `FORBIDDEN`.
