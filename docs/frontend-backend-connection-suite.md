# Suite de testeo de conexión Frontend/Backend

## Objetivo

Validar la conexión real entre:

- `front-protonlab`
- `protonlab_backend`

Tanto en desarrollo local como en despliegues en Vercel.

## 1. Suite desde el frontend

Repositorio: `front-protonlab`

Script:

```bash
npm run smoke:api
```

También sirve para Vercel:

```bash
npm run smoke:vercel
```

### Qué valida

- `GET /api/health`
- `GET /api/status`
- `GET /api/products`
- `GET /api/auth/me`
- `OPTIONS /api/ai/sql-assistant`
- `POST /api/ai/sql-assistant`

### Variables esperadas

```bash
VITE_PROTONLAB_API_BASE_URL=http://localhost:3000
VITE_API_VERSION=legacy
FRONTEND_ORIGIN=http://localhost:5173
SMOKE_BEARER_TOKEN=<token opcional>
```

## 2. Suite desde el backend

Repositorio: `protonlab_backend`

Script:

```bash
npm run smoke:connection
```

También sirve para Vercel:

```bash
npm run smoke:vercel
```

### Qué valida

- reachability del frontend
- `GET /api/health`
- `GET /api/status`
- CORS en endpoints públicos
- CORS del endpoint del asistente SQL
- gate de autenticación del asistente SQL

### Variables esperadas

```bash
BACKEND_BASE_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:5173
SMOKE_BEARER_TOKEN=<token opcional>
```

## 3. Qué necesita el backend del frontend

- URL pública del frontend para CORS
- dominio local del frontend durante desarrollo

Variables:

```bash
PROTONLAB_ALLOWED_ORIGINS=http://localhost:5173,https://tu-frontend.vercel.app
```

## 4. Qué necesita el frontend del backend

- URL pública base del backend
- versión del contrato API

Variables:

```bash
VITE_PROTONLAB_API_BASE_URL=https://tu-backend.vercel.app
VITE_API_VERSION=legacy
```

## 5. Requisitos compartidos para conexión real en Vercel

- ambos repos deben usar el mismo proyecto Firebase Auth
- el frontend debe obtener un token Firebase válido
- el backend debe verificar ese token con credenciales admin del mismo proyecto Firebase
- el rol del usuario debe existir en los custom claims aceptados por el backend

Variables backend:

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

Variables frontend:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 6. Consideración para el asistente IA en Vercel

Si el backend usa un modelo IA:

- `Ollama` local no sirve para Vercel
- el proveedor debe ser accesible públicamente

Variables típicas backend:

```bash
AI_SQL_API_KEY=...
AI_SQL_MODEL=...
AI_SQL_API_URL=...
AI_SQL_APP_NAME=ProtonLab Backend
AI_SQL_SITE_URL=https://tu-frontend.vercel.app
```

## 7. Secuencia recomendada de despliegue

1. Desplegar backend.
2. Copiar URL pública del backend.
3. Configurar esa URL en el frontend.
4. Desplegar frontend.
5. Copiar URL pública del frontend.
6. Configurar `PROTONLAB_ALLOWED_ORIGINS` en backend.
7. Redesplegar backend.
8. Ejecutar ambas smoke suites apuntando a URLs Vercel.
