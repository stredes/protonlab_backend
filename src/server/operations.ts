import { products } from "../data/catalog";
import { fail, ok } from "../utils/responses";
import {
  InputValidationError,
  assertSafePayload,
  parseAllowedValue,
  parsePageNumber,
  safeCsvCell,
  sanitizeEmail,
  sanitizeMoney,
  sanitizeQuantity,
  sanitizeText
} from "./input-security";

type OrderStatus =
  | "cotizacion"
  | "pendiente_vendedor"
  | "aprobado_vendedor"
  | "pendiente_admin"
  | "aprobado_admin"
  | "rechazado"
  | "confirmado"
  | "procesando"
  | "enviado"
  | "entregado"
  | "cancelado";

type PaymentStatus = "pendiente" | "parcial" | "pagado" | "reembolsado";

const ORDER_STATUSES: readonly OrderStatus[] = [
  "cotizacion",
  "pendiente_vendedor",
  "aprobado_vendedor",
  "pendiente_admin",
  "aprobado_admin",
  "rechazado",
  "confirmado",
  "procesando",
  "enviado",
  "entregado",
  "cancelado"
];

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pendiente", "parcial", "pagado", "reembolsado"];

const QUOTE_STATUSES = [
  "pendiente",
  "en_revision_vendedor",
  "aprobado_vendedor",
  "rechazado_vendedor",
  "en_revision_admin",
  "aprobado",
  "rechazado",
  "convertida"
] as const;

const SUPPORT_TYPES = [
  "preventa",
  "demostracion",
  "problema_tecnico",
  "mantenimiento_preventivo",
  "otro"
] as const;

const SUPPORT_STATUSES = ["nuevo", "asignado", "en_progreso", "resuelto", "cerrado"] as const;
const SUPPORT_PRIORITIES = ["baja", "media", "alta"] as const;

type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  sku?: string;
};

type ShippingAddress = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  contactName: string;
};

type QuoteStatus = (typeof QUOTE_STATUSES)[number];
type SupportType = (typeof SUPPORT_TYPES)[number];

export type OperationOrder = {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  taxId?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  vendorId?: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
};

export type OperationQuote = {
  id: string;
  quoteNumber: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  taxId?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: QuoteStatus;
  assignedSalesRep?: string;
  assignedSalesRepName?: string;
  vendorNotes?: string;
  adminNotes?: string;
  rejectionReason?: string;
  vendorApprovedAt?: string;
  adminApprovedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  type: SupportType;
  status: "nuevo" | "asignado" | "en_progreso" | "resuelto" | "cerrado";
  priority: "baja" | "media" | "alta";
  name: string;
  organization: string;
  email: string;
  phone?: string;
  equipment: string;
  serial?: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

const nowIso = () => new Date().toISOString();
const createdAt = "2026-05-20T12:00:00.000Z";

const sampleItems: OrderItem[] = products.slice(0, 2).map((product, index) => {
  const unitPrice = product.price ?? (index + 1) * 1000;
  const quantity = index + 1;
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantity,
    unitPrice,
    subtotal: unitPrice * quantity
  };
});

const sampleSubtotal = sampleItems.reduce((sum, item) => sum + item.subtotal, 0);

const orders: OperationOrder[] = [
  {
    id: "order-demo-1",
    orderNumber: "ORD-2026-0001",
    customerName: "Cliente Demo",
    customerEmail: "cliente@protonlab.cl",
    customerPhone: "+56 9 1234 5678",
    organization: "Protonlab Demo",
    items: sampleItems,
    subtotal: sampleSubtotal,
    discount: 0,
    tax: 0,
    shippingCost: 0,
    total: sampleSubtotal,
    status: "procesando",
    paymentStatus: "pendiente",
    paymentMethod: "transferencia",
    vendorId: "vendor-demo",
    shippingAddress: {
      street: "Av. Providencia 1234",
      city: "Santiago",
      state: "RM",
      zipCode: "7500000",
      country: "Chile",
      phone: "+56 9 1234 5678",
      contactName: "Cliente Demo"
    },
    createdAt,
    updatedAt: createdAt
  }
];

const quotes: OperationQuote[] = [
  {
    id: "quote-demo-1",
    quoteNumber: "QUO-2026-0001",
    customerName: "Cliente Demo",
    customerEmail: "cliente@protonlab.cl",
    customerPhone: "+56 9 1234 5678",
    organization: "Protonlab Demo",
    items: sampleItems,
    subtotal: sampleSubtotal,
    discount: 0,
    tax: 0,
    total: sampleSubtotal,
    status: "pendiente",
    assignedSalesRep: "vendor-demo",
    createdAt,
    updatedAt: createdAt
  }
];

const supportTickets: SupportTicket[] = [];

function paginate<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const page = parsePageNumber(url.searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
  const pageSize = parsePageNumber(url.searchParams.get("pageSize"), 50, 200);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize
  };
}

function matchesQuery(value: string | undefined, query: string | null): boolean {
  if (!query) return true;
  return (value ?? "").toLowerCase() === query.toLowerCase();
}

function failValidation(error: unknown, request: Request): Response | undefined {
  if (error instanceof InputValidationError) {
    return fail(error.message, { status: 400, code: "VALIDATION_ERROR", request });
  }

  return undefined;
}

function sanitizeOptionalText(value: unknown, field: string, maxLength: number): string | undefined {
  return sanitizeText(value, { field, maxLength });
}

function normalizeOrderItems(value: unknown): OrderItem[] {
  const items = Array.isArray(value) ? value : [];
  return items.map((item, index) => {
    const raw = item as Record<string, unknown>;
    const quantity = sanitizeQuantity(raw.quantity, `items.${index}.quantity`);
    const unitPrice = sanitizeMoney(raw.unitPrice, `items.${index}.unitPrice`);

    return {
      productId: sanitizeText(raw.productId ?? `item-${index + 1}`, {
        field: `items.${index}.productId`,
        required: true,
        maxLength: 80
      })!,
      productName: sanitizeText(raw.productName ?? raw.name ?? "Producto", {
        field: `items.${index}.productName`,
        required: true,
        maxLength: 160
      })!,
      sku: sanitizeOptionalText(raw.sku, `items.${index}.sku`, 80),
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity
    };
  });
}

function normalizeShippingAddress(value: unknown): ShippingAddress {
  const address = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  return {
    street: sanitizeOptionalText(address.street, "shippingAddress.street", 160) ?? "",
    city: sanitizeOptionalText(address.city, "shippingAddress.city", 80) ?? "",
    state: sanitizeOptionalText(address.state, "shippingAddress.state", 80) ?? "",
    zipCode: sanitizeOptionalText(address.zipCode, "shippingAddress.zipCode", 30) ?? "",
    country: sanitizeOptionalText(address.country, "shippingAddress.country", 80) ?? "Chile",
    phone: sanitizeOptionalText(address.phone, "shippingAddress.phone", 40) ?? "",
    contactName: sanitizeOptionalText(address.contactName, "shippingAddress.contactName", 120) ?? ""
  };
}

function normalizeQuotePayload(payload: Record<string, unknown>): OperationQuote {
  const shippingAddress = payload.shippingAddress as Record<string, unknown> | undefined;
  const normalizedItems = normalizeOrderItems(payload.items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const firstName = sanitizeText(shippingAddress?.firstName ?? "Cliente", {
    field: "shippingAddress.firstName",
    required: true,
    maxLength: 80
  });
  const lastName = sanitizeOptionalText(shippingAddress?.lastName, "shippingAddress.lastName", 80) ?? "";
  const id = `quote_${crypto.randomUUID().slice(0, 8)}`;
  const created = nowIso();

  return {
    id,
    quoteNumber: `QUO-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, "0")}`,
    customerName: `${firstName} ${lastName}`.trim(),
    customerEmail: sanitizeEmail(payload.email ?? "cliente@protonlab.cl"),
    customerPhone: sanitizeOptionalText(shippingAddress?.phone, "shippingAddress.phone", 40) ?? "",
    organization: sanitizeText(shippingAddress?.addressLine1 ?? "Pendiente", {
      field: "shippingAddress.addressLine1",
      required: true,
      maxLength: 160
    })!,
    items: normalizedItems,
    subtotal,
    discount: 0,
    tax: 0,
    total: subtotal,
    status: "pendiente",
    createdAt: created,
    updatedAt: created
  };
}

function quoteToOrder(quote: OperationQuote): OperationOrder {
  const created = nowIso();
  return {
    id: `order_${crypto.randomUUID().slice(0, 8)}`,
    orderNumber: `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`,
    userId: quote.userId,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    organization: quote.organization,
    taxId: quote.taxId,
    items: quote.items,
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    shippingCost: 0,
    total: quote.total,
    status: "confirmado",
    paymentStatus: "pendiente",
    paymentMethod: "transferencia",
    vendorId: quote.assignedSalesRep,
    shippingAddress: {
      street: "Pendiente",
      city: "Pendiente",
      state: "",
      zipCode: "",
      country: "Chile",
      phone: quote.customerPhone,
      contactName: quote.customerName
    },
    createdAt: created,
    updatedAt: created,
    confirmedAt: created
  };
}

export function registerQuoteFromPayload(payload: Record<string, unknown>): OperationQuote {
  assertSafePayload(payload);
  const quote = normalizeQuotePayload(payload);
  quotes.unshift(quote);
  return quote;
}

export async function listQuotes(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const customerEmail = url.searchParams.get("customerEmail");
  const quoteNumber = url.searchParams.get("quoteNumber");
  const filtered = quotes.filter(
    (quote) =>
      matchesQuery(quote.status, status) &&
      matchesQuery(quote.customerEmail, customerEmail) &&
      (!quoteNumber || quote.quoteNumber.toLowerCase().includes(quoteNumber.toLowerCase()))
  );

  return ok(paginate(filtered, request), request);
}

export async function getQuote(request: Request, quoteId: string): Promise<Response> {
  const quote = quotes.find((entry) => entry.id === quoteId || entry.quoteNumber === quoteId);
  if (!quote) return fail("Cotización no encontrada", { status: 404, code: "NOT_FOUND", request });
  return ok(quote, request);
}

export async function updateQuote(request: Request, quoteId: string): Promise<Response> {
  const quote = quotes.find((entry) => entry.id === quoteId || entry.quoteNumber === quoteId);
  if (!quote) return fail("Cotización no encontrada", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
    const status = parseAllowedValue(payload.status, QUOTE_STATUSES, "status");

    Object.assign(quote, {
      status: status ?? quote.status,
      vendorNotes: sanitizeOptionalText(payload.vendorNotes, "vendorNotes", 1000) ?? quote.vendorNotes,
      adminNotes: sanitizeOptionalText(payload.adminNotes, "adminNotes", 1000) ?? quote.adminNotes,
      rejectionReason: sanitizeOptionalText(payload.rejectionReason, "rejectionReason", 500) ?? quote.rejectionReason,
      updatedAt: nowIso()
    });
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }

  return ok({ quote }, request);
}

export async function approveQuote(request: Request, quoteId: string, level: "vendor" | "admin"): Promise<Response> {
  const quote = quotes.find((entry) => entry.id === quoteId || entry.quoteNumber === quoteId);
  if (!quote) return fail("Cotización no encontrada", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
  const approved = payload.approved !== false;
  const timestamp = nowIso();

  if (approved) {
    quote.status = level === "vendor" ? "aprobado_vendedor" : "aprobado";
    if (level === "vendor") quote.vendorApprovedAt = timestamp;
    if (level === "admin") quote.adminApprovedAt = timestamp;
  } else {
    quote.status = level === "vendor" ? "rechazado_vendedor" : "rechazado";
    try {
      quote.rejectionReason =
        sanitizeOptionalText(payload.rejectionReason, "rejectionReason", 500) ?? "Sin motivo informado";
    } catch (error) {
      const response = failValidation(error, request);
      if (response) return response;
      throw error;
    }
  }

  quote.updatedAt = timestamp;
  return ok({ quote }, request);
}

export async function convertQuoteToOrder(request: Request, quoteId: string): Promise<Response> {
  const quote = quotes.find((entry) => entry.id === quoteId || entry.quoteNumber === quoteId);
  if (!quote) return fail("Cotización no encontrada", { status: 404, code: "NOT_FOUND", request });

  const order = quoteToOrder(quote);
  orders.unshift(order);
  quote.status = "convertida";
  quote.updatedAt = nowIso();

  return ok({ quote, order }, request, 201);
}

export async function listOrders(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const paymentStatus = url.searchParams.get("paymentStatus");
  const customerEmail = url.searchParams.get("customerEmail");
  const orderNumber = url.searchParams.get("orderNumber");
  const filtered = orders.filter(
    (order) =>
      matchesQuery(order.status, status) &&
      matchesQuery(order.paymentStatus, paymentStatus) &&
      matchesQuery(order.customerEmail, customerEmail) &&
      (!orderNumber || order.orderNumber.toLowerCase().includes(orderNumber.toLowerCase()))
  );

  return ok(paginate(filtered, request), request);
}

export async function getOrder(request: Request, orderId: string): Promise<Response> {
  const order = orders.find((entry) => entry.id === orderId || entry.orderNumber === orderId);
  if (!order) return fail("Pedido no encontrado", { status: 404, code: "NOT_FOUND", request });
  return ok(order, request);
}

export async function createOrder(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return fail("JSON inválido", { status: 400, code: "VALIDATION_ERROR", request });

  try {
    assertSafePayload(payload);
    const items = normalizeOrderItems(payload.items);
    const created = nowIso();
    const order: OperationOrder = {
      id: `order_${crypto.randomUUID().slice(0, 8)}`,
      orderNumber: `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`,
      customerName: sanitizeText(payload.customerName ?? "Cliente", {
        field: "customerName",
        required: true,
        maxLength: 120
      })!,
      customerEmail: sanitizeEmail(payload.customerEmail ?? "cliente@protonlab.cl", "customerEmail"),
      customerPhone: sanitizeOptionalText(payload.customerPhone, "customerPhone", 40) ?? "",
      organization: sanitizeOptionalText(payload.organization, "organization", 160) ?? "",
      taxId: sanitizeOptionalText(payload.taxId, "taxId", 30),
      items,
      subtotal: sanitizeMoney(payload.subtotal, "subtotal"),
      discount: sanitizeMoney(payload.discount, "discount"),
      tax: sanitizeMoney(payload.tax, "tax"),
      shippingCost: sanitizeMoney(payload.shippingCost, "shippingCost"),
      total: sanitizeMoney(payload.total, "total"),
      status: "confirmado",
      paymentStatus: "pendiente",
      paymentMethod: sanitizeOptionalText(payload.paymentMethod, "paymentMethod", 80) ?? "transferencia",
      shippingAddress: normalizeShippingAddress(payload.shippingAddress),
      createdAt: created,
      updatedAt: created
    };
    orders.unshift(order);
    return ok(order, request, 201);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
}

export async function updateOrder(request: Request, orderId: string): Promise<Response> {
  const order = orders.find((entry) => entry.id === orderId || entry.orderNumber === orderId);
  if (!order) return fail("Pedido no encontrado", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
    const status = parseAllowedValue(payload.status, ORDER_STATUSES, "status");
    const paymentStatus = parseAllowedValue(payload.paymentStatus, PAYMENT_STATUSES, "paymentStatus");

    Object.assign(order, {
      status: status ?? order.status,
      paymentStatus: paymentStatus ?? order.paymentStatus,
      trackingNumber: sanitizeOptionalText(payload.trackingNumber, "trackingNumber", 120) ?? order.trackingNumber,
      updatedAt: nowIso()
    });
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }

  if (payload.status === "enviado") order.shippedAt = order.updatedAt;
  if (payload.status === "entregado") order.deliveredAt = order.updatedAt;
  if (payload.status === "cancelado") order.cancelledAt = order.updatedAt;

  return ok(order, request);
}

export async function cancelOrder(request: Request, orderId: string): Promise<Response> {
  const order = orders.find((entry) => entry.id === orderId || entry.orderNumber === orderId);
  if (!order) return fail("Pedido no encontrado", { status: 404, code: "NOT_FOUND", request });

  order.status = "cancelado";
  order.cancelledAt = nowIso();
  order.updatedAt = order.cancelledAt;
  return ok({ message: "Pedido cancelado" }, request);
}

export async function createSupportTicket(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return fail("JSON inválido", { status: 400, code: "VALIDATION_ERROR", request });

  try {
    assertSafePayload(payload);
    const created = nowIso();
    const ticket: SupportTicket = {
      id: `ticket_${crypto.randomUUID().slice(0, 8)}`,
      ticketNumber: `SUP-${new Date().getFullYear()}-${String(supportTickets.length + 1).padStart(4, "0")}`,
      type: parseAllowedValue(payload.type ?? "otro", SUPPORT_TYPES, "type") ?? "otro",
      status: "nuevo",
      priority: "media",
      name: sanitizeText(payload.name, { field: "name", required: true, maxLength: 120 })!,
      organization: sanitizeText(payload.organization, { field: "organization", required: true, maxLength: 160 })!,
      email: sanitizeEmail(payload.email),
      phone: sanitizeOptionalText(payload.phone, "phone", 40),
      equipment: sanitizeText(payload.equipment, { field: "equipment", required: true, maxLength: 160 })!,
      serial: sanitizeOptionalText(payload.serial, "serial", 80),
      comment: sanitizeText(payload.comment, { field: "comment", required: true, maxLength: 2000 })!,
      createdAt: created,
      updatedAt: created
    };
    supportTickets.unshift(ticket);
    return ok({ ticket }, request, 201);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
}

export async function listSupportTickets(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const email = url.searchParams.get("email");
  const filtered = supportTickets.filter(
    (ticket) => matchesQuery(ticket.status, status) && matchesQuery(ticket.email, email)
  );

  return ok(paginate(filtered, request), request);
}

export async function updateSupportTicket(request: Request, ticketId: string): Promise<Response> {
  const ticket = supportTickets.find((entry) => entry.id === ticketId || entry.ticketNumber === ticketId);
  if (!ticket) return fail("Ticket no encontrado", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
    const status = parseAllowedValue(payload.status, SUPPORT_STATUSES, "status");
    const priority = parseAllowedValue(payload.priority, SUPPORT_PRIORITIES, "priority");
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
  ticket.updatedAt = nowIso();

  return ok({ ticket }, request);
}

export async function getUserHistory(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const customerEmail = url.searchParams.get("customerEmail") ?? url.searchParams.get("email");
  const userOrders = customerEmail ? orders.filter((order) => matchesQuery(order.customerEmail, customerEmail)) : orders;
  const userQuotes = customerEmail ? quotes.filter((quote) => matchesQuery(quote.customerEmail, customerEmail)) : quotes;
  const userTickets = customerEmail
    ? supportTickets.filter((ticket) => matchesQuery(ticket.email, customerEmail))
    : supportTickets;

  return ok(
    {
      orders: userOrders,
      quotes: userQuotes,
      supportTickets: userTickets
    },
    request
  );
}

export async function exportAuditReport(request: Request): Promise<Response> {
  const rows = [
    ["type", "id", "status", "customerEmail", "createdAt", "updatedAt"],
    ...quotes.map((quote) => ["quote", quote.id, quote.status, quote.customerEmail, quote.createdAt, quote.updatedAt]),
    ...orders.map((order) => ["order", order.id, order.status, order.customerEmail, order.createdAt, order.updatedAt]),
    ...supportTickets.map((ticket) => ["support", ticket.id, ticket.status, ticket.email, ticket.createdAt, ticket.updatedAt])
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${safeCsvCell(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="protonlab-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
