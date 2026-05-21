const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const HTML_MARKERS = /[<>]|javascript:/i;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export function assertSafePayload(value: unknown, path = "payload"): void {
  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) {
      throw new InputValidationError(`Campo inválido: ${path}.${key}`);
    }

    assertSafePayload(nestedValue, `${path}.${key}`);
  }
}

type TextOptions = {
  field: string;
  required?: boolean;
  maxLength?: number;
};

export function sanitizeText(value: unknown, options: TextOptions): string | undefined {
  if (value === undefined || value === null) {
    if (options.required) throw new InputValidationError(`${options.field} es requerido`);
    return undefined;
  }

  if (typeof value !== "string") {
    throw new InputValidationError(`${options.field} debe ser texto`);
  }

  const text = value.trim();
  if (options.required && !text) throw new InputValidationError(`${options.field} es requerido`);
  if (CONTROL_CHARS.test(text) || HTML_MARKERS.test(text)) {
    throw new InputValidationError(`${options.field} contiene caracteres no permitidos`);
  }
  if (options.maxLength && text.length > options.maxLength) {
    throw new InputValidationError(`${options.field} supera el largo permitido`);
  }

  return text || undefined;
}

export function sanitizeEmail(value: unknown, field = "email"): string {
  const email = sanitizeText(value, { field, required: true, maxLength: 254 });
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new InputValidationError(`${field} inválido`);
  }

  return email.toLowerCase();
}

export function sanitizeMoney(value: unknown, field: string): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new InputValidationError(`${field} debe ser un número positivo`);
  }

  return amount;
}

export function sanitizeQuantity(value: unknown, field: string): number {
  const quantity = Number(value ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    throw new InputValidationError(`${field} debe ser una cantidad válida`);
  }

  return quantity;
}

export function parseAllowedValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new InputValidationError(`${field} inválido`);
  }

  return value as T;
}

export function parsePageNumber(value: string | null, fallback: number, max: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

export function safeCsvCell(value: unknown): string {
  const cell = String(value ?? "");
  return CSV_FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
}
