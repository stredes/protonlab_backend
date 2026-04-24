export const ROLES = [
  "root",
  "admin",
  "vendedor",
  "bodega",
  "callcenter",
  "soporte",
  "socio",
  "cliente"
] as const;

export type Role = (typeof ROLES)[number];

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  role: Role;
};
