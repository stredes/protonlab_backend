export type AssistantEntity =
  | "user"
  | "product"
  | "order"
  | "quote"
  | "ticket"
  | "inventory"
  | "unknown";

export type AssistantAction =
  | "count"
  | "list"
  | "create"
  | "update"
  | "delete"
  | "unknown";

export type AssistantIntent = {
  action: AssistantAction;
  entity: AssistantEntity;
  confidence: number;
  normalizedQuestion: string;
  requiresTemplate: boolean;
  requiresConfirmation: boolean;
};

export type ActionTemplate = {
  action: AssistantAction;
  entity: AssistantEntity;
  title: string;
  requiredFields: string[];
  optionalFields: string[];
  detectedFields: Record<string, string | number | boolean>;
  confirmationRequired: boolean;
  destructive: boolean;
};

const productAvailabilityValues = ["disponible", "bajo_pedido", "sujeto_stock"] as const;

export function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function wordsFrom(question: string): string[] {
  return normalizeQuestion(question).match(/[a-z0-9@._-]+/g) ?? [];
}

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function isCloseWord(word: string, expected: string): boolean {
  if (word === expected || word.includes(expected) || expected.includes(word)) {
    return true;
  }

  if (word.length < 4 || expected.length < 4) {
    return false;
  }

  const distance = levenshteinDistance(word, expected);
  return distance <= (expected.length >= 8 ? 2 : 1);
}

function hasAnyWord(words: string[], expectedWords: string[]): boolean {
  return words.some((word) =>
    expectedWords.some((expected) => isCloseWord(word, expected))
  );
}

export function hasUserInventoryTerm(question: string): boolean {
  const words = wordsFrom(question);

  return words.some((word) => {
    if (/^(users?|cuentas?)$/.test(word)) {
      return true;
    }

    return (
      word.includes("usuario") ||
      word.includes("usuarios") ||
      /^(s?u?sarios?|s?u?suario?s?)$/.test(word)
    );
  });
}

export function isUserQuestion(question: string): boolean {
  const words = wordsFrom(question);

  return (
    hasUserInventoryTerm(question) &&
    hasAnyWord(words, ["cuanto", "cuantos", "cantidad", "existen", "hay", "lista", "listar", "muestra", "mostrar", "ver"])
  );
}

export function isProductQuestion(question: string): boolean {
  const words = wordsFrom(question);

  return (
    hasAnyWord(words, ["producto", "productos", "catalogo", "inventario", "item", "items"]) &&
    hasAnyWord(words, ["cuanto", "cuantos", "cantidad", "existen", "hay", "lista", "listar", "muestra", "mostrar", "ver"])
  );
}

function detectAction(words: string[]): AssistantAction {
  if (hasAnyWord(words, ["crear", "crea", "agregar", "agrega", "insertar", "registrar", "nuevo", "alta"])) {
    return "create";
  }

  if (hasAnyWord(words, ["editar", "actualizar", "modificar", "cambiar", "corregir"])) {
    return "update";
  }

  if (hasAnyWord(words, ["borrar", "eliminar", "elimina", "delete", "remover", "desactivar"])) {
    return "delete";
  }

  if (hasAnyWord(words, ["cuanto", "cuantos", "cantidad", "total", "contar"])) {
    return "count";
  }

  if (hasAnyWord(words, ["listar", "lista", "mostrar", "muestra", "ver"])) {
    return "list";
  }

  return "unknown";
}

function detectEntity(words: string[]): AssistantEntity {
  if (hasAnyWord(words, ["usuario", "usuarios", "usario", "susario", "cuenta", "cliente", "admin"])) {
    return "user";
  }

  if (hasAnyWord(words, ["producto", "productos", "prodcuto", "prdcto", "catalogo", "sku", "item"])) {
    return "product";
  }

  if (hasAnyWord(words, ["pedido", "pedidos", "orden", "ordenes", "compra"])) {
    return "order";
  }

  if (hasAnyWord(words, ["cotizacion", "cotizaciones", "quote", "presupuesto"])) {
    return "quote";
  }

  if (hasAnyWord(words, ["ticket", "tickets", "soporte", "incidencia"])) {
    return "ticket";
  }

  if (hasAnyWord(words, ["inventario", "stock", "bodega", "existencia", "existencias"])) {
    return "inventory";
  }

  return "unknown";
}

function extractDetectedFields(question: string, entity: AssistantEntity): Record<string, string | number | boolean> {
  const normalized = normalizeQuestion(question);
  const fields: Record<string, string | number | boolean> = {};
  const email = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
  const sku = normalized.match(/\b(?:sku|codigo|code)\s*[:#-]?\s*([a-z0-9._-]+)/)?.[1];
  const price = normalized.match(/\b(?:precio|price|valor)\s*[:#-]?\s*(\d+(?:[.,]\d+)?)/)?.[1];
  const stock = normalized.match(/\b(?:stock|cantidad)\s*[:#-]?\s*(\d+)/)?.[1];
  const role = normalized.match(/\b(?:rol|role)\s*[:#-]?\s*(root|admin|vendedor|bodega|callcenter|soporte|cliente)\b/)?.[1];
  const name = normalized.match(
    /\b(?:nombre|name)\s*[:#-]?\s*([a-z0-9 ._-]{3,80}?)(?=\s+\b(?:precio|price|valor|stock|cantidad|sku|codigo|code|categoria|category|rol|role)\b|$)/
  )?.[1]?.trim();

  if (email) fields.email = email;
  if (sku) fields.sku = sku.toUpperCase();
  if (price) fields.price = Number(price.replace(",", "."));
  if (stock) fields.stock = Number(stock);
  if (role) fields.role = role;
  if (name) fields.name = name;

  if (entity === "product") {
    const availability = normalized.match(/\b(disponible|bajo_pedido|sujeto_stock)\b/)?.[1];
    const categoryId = normalized.match(/\b(?:categoria|category)\s*[:#-]?\s*([a-z0-9._-]+)/)?.[1];
    if (availability) fields.availability = availability;
    if (categoryId) fields.categoryId = categoryId;
  }

  return fields;
}

function parseProductCsvFields(question: string): Record<string, string | number | boolean> | null {
  const normalized = normalizeQuestion(question)
    .replace(/^confirmar\s+crear\s+producto\s*[:,-]?\s*/i, "")
    .replace(/^crear\s+producto\s*[:,-]?\s*/i, "")
    .trim();
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 5 || parts.length > 8) {
    return null;
  }

  const [name, sku, categoryId, price, stock, availability] = parts;
  const fields: Record<string, string | number | boolean> = {
    name,
    sku: sku.toUpperCase(),
    categoryId,
    price: Number(price.replace(",", ".")),
    stock: Number.parseInt(stock, 10)
  };

  if (availability && productAvailabilityValues.includes(availability as typeof productAvailabilityValues[number])) {
    fields.availability = availability;
  }

  return fields;
}

export function isProductCsvTemplate(question: string): boolean {
  return parseProductCsvFields(question) !== null;
}

export function isConfirmedProductCreate(question: string): boolean {
  return /^confirmar\s+crear\s+producto\b/i.test(normalizeQuestion(question));
}

export function classifyAssistantIntent(question: string): AssistantIntent {
  const normalizedQuestion = normalizeQuestion(question);
  if (isProductCsvTemplate(question)) {
    return {
      action: "create",
      entity: "product",
      confidence: 0.9,
      normalizedQuestion,
      requiresTemplate: true,
      requiresConfirmation: true
    };
  }

  const words = wordsFrom(question);
  const action = detectAction(words);
  const entity = detectEntity(words);
  const requiresTemplate = ["create", "update", "delete"].includes(action);
  const requiresConfirmation = requiresTemplate;
  const confidence =
    action === "unknown" || entity === "unknown"
      ? 0.35
      : requiresTemplate
        ? 0.88
        : 0.75;

  return {
    action,
    entity,
    confidence,
    normalizedQuestion,
    requiresTemplate,
    requiresConfirmation
  };
}

export function buildActionTemplate(question: string): ActionTemplate | null {
  const intent = classifyAssistantIntent(question);
  if (!intent.requiresTemplate || intent.entity === "unknown") {
    return null;
  }

  const destructive = intent.action === "delete";
  const detectedFields =
    intent.action === "create" && intent.entity === "product"
      ? {
          ...extractDetectedFields(question, intent.entity),
          ...(parseProductCsvFields(question) ?? {})
        }
      : extractDetectedFields(question, intent.entity);
  const templates: Record<string, Omit<ActionTemplate, "detectedFields">> = {
    "create:user": {
      action: "create",
      entity: "user",
      title: "Crear usuario",
      requiredFields: ["email", "displayName", "role", "temporaryPassword"],
      optionalFields: ["phone", "companyName", "isActive"],
      confirmationRequired: true,
      destructive: false
    },
    "update:user": {
      action: "update",
      entity: "user",
      title: "Actualizar usuario",
      requiredFields: ["emailOrUid", "fieldsToUpdate"],
      optionalFields: ["displayName", "role", "phone", "isActive"],
      confirmationRequired: true,
      destructive: false
    },
    "delete:user": {
      action: "delete",
      entity: "user",
      title: "Eliminar o desactivar usuario",
      requiredFields: ["emailOrUid", "deleteMode"],
      optionalFields: ["reason"],
      confirmationRequired: true,
      destructive: true
    },
    "create:product": {
      action: "create",
      entity: "product",
      title: "Crear producto",
      requiredFields: ["name", "sku", "categoryId", "price", "stock", "availability"],
      optionalFields: ["brand", "family", "shortDescription", "image", "requiresInstallation", "requiresMaintenance"],
      confirmationRequired: true,
      destructive: false
    },
    "update:product": {
      action: "update",
      entity: "product",
      title: "Actualizar producto",
      requiredFields: ["productIdOrSku", "fieldsToUpdate"],
      optionalFields: ["name", "price", "stock", "availability", "categoryId", "image"],
      confirmationRequired: true,
      destructive: false
    },
    "delete:product": {
      action: "delete",
      entity: "product",
      title: "Eliminar o desactivar producto",
      requiredFields: ["productIdOrSku", "deleteMode"],
      optionalFields: ["reason"],
      confirmationRequired: true,
      destructive: true
    }
  };

  const template =
    templates[`${intent.action}:${intent.entity}`] ??
    {
      action: intent.action,
      entity: intent.entity,
      title: `${intent.action} ${intent.entity}`,
      requiredFields: ["targetId", "fieldsToUpdate"],
      optionalFields: ["reason"],
      confirmationRequired: true,
      destructive
    };

  return {
    ...template,
    detectedFields
  };
}
