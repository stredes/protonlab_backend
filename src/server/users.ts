import type { UserRecord } from "firebase-admin/auth";

import { getFirebaseAuth } from "../lib/firebaseAdmin";
import { ROLES, type AuthenticatedUser, type Role } from "../models/user";
import { fail, ok } from "../utils/responses";

type UserRole = Exclude<Role, "cliente">;

type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  vendorId?: string;
  phone?: string;
  department?: string;
  isActive: boolean;
};

type AuthAdapter = {
  verifyIdToken?: (token: string) => Promise<Record<string, unknown>>;
  listUsers?: (maxResults?: number, pageToken?: string) => Promise<{
    users: UserRecord[];
    pageToken?: string;
  }>;
  getUser?: (uid: string) => Promise<UserRecord>;
  createUser: (properties: {
    email: string;
    password: string;
    displayName: string;
    disabled: boolean;
  }) => Promise<Pick<UserRecord, "uid" | "email" | "displayName" | "disabled" | "customClaims">>;
  updateUser?: (
    uid: string,
    properties: {
      email?: string;
      password?: string;
      displayName?: string;
      disabled?: boolean;
    }
  ) => Promise<UserRecord>;
  deleteUser?: (uid: string) => Promise<void>;
  setCustomUserClaims: (uid: string, customUserClaims: Record<string, unknown>) => Promise<void>;
};

type HandlerDependencies = {
  authorizeRoot?: (request: Request) => Promise<AuthenticatedUser | null>;
  auth?: AuthAdapter;
};

const VALID_USER_ROLES = ROLES.filter((role): role is UserRole => role !== "cliente");

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function parseRole(value: unknown): UserRole {
  if (typeof value === "string" && VALID_USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }

  return "socio";
}

function getClaims(record: Pick<UserRecord, "customClaims">): Record<string, unknown> {
  return record.customClaims ?? {};
}

function mapUser(record: Pick<UserRecord, "uid" | "email" | "displayName" | "disabled" | "customClaims">): ApiUser {
  const claims = getClaims(record);

  return {
    id: record.uid,
    email: record.email ?? "",
    name: record.displayName || record.email?.split("@")[0] || "Usuario",
    role: parseRole(claims.role),
    company: typeof claims.company === "string" ? claims.company : undefined,
    vendorId: typeof claims.vendorId === "string" ? claims.vendorId : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    department: typeof claims.department === "string" ? claims.department : undefined,
    isActive: record.disabled ? false : claims.isActive !== false
  };
}

function createClaims(input: Record<string, unknown>, isActive = true): Record<string, unknown> {
  return {
    role: parseRole(input.role),
    ...(typeof input.vendorId === "string" && input.vendorId.trim()
      ? { vendorId: input.vendorId.trim() }
      : {}),
    ...(typeof input.company === "string" && input.company.trim()
      ? { company: input.company.trim() }
      : {}),
    ...(typeof input.phone === "string" && input.phone.trim()
      ? { phone: input.phone.trim() }
      : {}),
    ...(typeof input.department === "string" && input.department.trim()
      ? { department: input.department.trim() }
      : {}),
    isActive
  };
}

async function defaultAuthorizeRoot(request: Request): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const decodedToken = await getFirebaseAuth().verifyIdToken(token);
  const claims = decodedToken as Record<string, unknown>;
  const role = parseRole(
    claims.role ??
      claims["https://protonlab.cl/role"] ??
      claims["https://schemas.protonlab.cl/role"]
  );

  if (role !== "root") {
    return null;
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    role
  };
}

async function ensureRoot(
  request: Request,
  authorizeRoot: (request: Request) => Promise<AuthenticatedUser | null>
): Promise<AuthenticatedUser | Response> {
  try {
    const user = await authorizeRoot(request);
    if (user?.role === "root") {
      return user;
    }
  } catch {
    return fail("Token inválido", {
      status: 401,
      code: "TOKEN_INVALID",
      request
    });
  }

  return fail("No autorizado", {
    status: 403,
    code: "FORBIDDEN",
    request
  });
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const payload = await request.json();
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
  } catch {
    return fail("JSON inválido", {
      status: 400,
      code: "VALIDATION_ERROR",
      request
    });
  }

  return fail("Payload inválido", {
    status: 400,
    code: "VALIDATION_ERROR",
    request
  });
}

function getRequiredString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function listAllUsers(auth: AuthAdapter): Promise<ApiUser[]> {
  if (!auth.listUsers) {
    return [];
  }

  const users: ApiUser[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map(mapUser));
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

export function createUserManagementHandler(dependencies: HandlerDependencies = {}) {
  const authorizeRoot = dependencies.authorizeRoot ?? defaultAuthorizeRoot;
  const getAuthAdapter = () => dependencies.auth ?? getFirebaseAuth();

  return {
    async list(request: Request): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const users = await listAllUsers(getAuthAdapter());
      return ok({ users, items: users }, request);
    },

    async listByRole(request: Request, role: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const requestedRole = parseRole(role);
      const vendorId = new URL(request.url).searchParams.get("vendorId");
      const users = (await listAllUsers(getAuthAdapter())).filter((user) => {
        if (user.role !== requestedRole) return false;
        return vendorId ? user.vendorId === vendorId : true;
      });

      return ok({ users, items: users }, request);
    },

    async get(request: Request, userId: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const auth = getAuthAdapter();

      if (!auth.getUser) {
        return fail("Usuario no encontrado", {
          status: 404,
          code: "NOT_FOUND",
          request
        });
      }

      const user = mapUser(await auth.getUser(userId));
      return ok({ user }, request);
    },

    async create(request: Request): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const payload = await parseJsonObject(request);
      if (payload instanceof Response) return payload;

      const name = getRequiredString(payload, "name");
      const email = getRequiredString(payload, "email");
      const password = getRequiredString(payload, "password");

      if (!name || !email || !password) {
        return fail("Faltan datos obligatorios del usuario", {
          status: 400,
          code: "VALIDATION_ERROR",
          request
        });
      }

      try {
        const auth = getAuthAdapter();
        const createdUser = await auth.createUser({
          email,
          password,
          displayName: name,
          disabled: false
        });
        const claims = createClaims(payload, true);
        await auth.setCustomUserClaims(createdUser.uid, claims);

        return ok(
          {
            user: mapUser({
              ...createdUser,
              customClaims: claims,
              disabled: false
            })
          },
          request,
          201
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "No fue posible crear el usuario.";
        const isConflict = /already|exists|email-already-exists/i.test(message);

        return fail(isConflict ? "Ya existe un usuario con ese correo" : message, {
          status: isConflict ? 409 : 500,
          code: isConflict ? "USER_ALREADY_EXISTS" : "INTERNAL_ERROR",
          request
        });
      }
    },

    async update(request: Request, userId: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const payload = await parseJsonObject(request);
      if (payload instanceof Response) return payload;

      const auth = getAuthAdapter();

      if (!auth.updateUser) {
        return fail("Actualización de usuarios no disponible", {
          status: 500,
          code: "INTERNAL_ERROR",
          request
        });
      }

      const updatedUser = await auth.updateUser(userId, {
        email: getRequiredString(payload, "email") ?? undefined,
        password: getRequiredString(payload, "password") ?? undefined,
        displayName: getRequiredString(payload, "name") ?? undefined
      });
      const claims = createClaims(payload, updatedUser.disabled === false);
      await auth.setCustomUserClaims(userId, claims);

      return ok({ user: mapUser({ ...updatedUser, customClaims: claims }) }, request);
    },

    async remove(request: Request, userId: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      await getAuthAdapter().deleteUser?.(userId);
      return ok({ deleted: true }, request);
    },

    async setStatus(request: Request, userId: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const payload = await parseJsonObject(request);
      if (payload instanceof Response) return payload;

      const isActive = payload.isActive !== false;
      const auth = getAuthAdapter();
      const updatedUser = await auth.updateUser?.(userId, { disabled: !isActive });
      if (!updatedUser) {
        return fail("Usuario no encontrado", {
          status: 404,
          code: "NOT_FOUND",
          request
        });
      }

      const claims = { ...getClaims(updatedUser), isActive };
      await auth.setCustomUserClaims(userId, claims);
      return ok({ user: mapUser({ ...updatedUser, customClaims: claims }) }, request);
    },

    async resetPassword(request: Request, userId: string): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      const payload = await parseJsonObject(request);
      if (payload instanceof Response) return payload;

      const password = getRequiredString(payload, "password");
      if (!password) {
        return fail("Contraseña requerida", {
          status: 400,
          code: "VALIDATION_ERROR",
          request
        });
      }

      await getAuthAdapter().updateUser?.(userId, { password });
      return ok({ updated: true }, request);
    },

    async audit(request: Request): Promise<Response> {
      const root = await ensureRoot(request, authorizeRoot);
      if (root instanceof Response) return root;

      return ok({ items: [] }, request);
    }
  };
}
