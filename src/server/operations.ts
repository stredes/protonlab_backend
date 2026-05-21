import { products } from "../data/catalog";
import { fail, ok } from "../utils/responses";

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
  status: string;
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
  type: string;
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
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? "50"), 1), 200);
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

function normalizeQuotePayload(payload: Record<string, unknown>): OperationQuote {
  const shippingAddress = payload.shippingAddress as Record<string, unknown> | undefined;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const normalizedItems = items.map((item, index) => {
    const raw = item as Record<string, unknown>;
    const quantity = Number(raw.quantity ?? 1);
    const unitPrice = Number(raw.unitPrice ?? 0);
    return {
      productId: String(raw.productId ?? `item-${index + 1}`),
      productName: String(raw.productName ?? raw.name ?? "Producto"),
      sku: typeof raw.sku === "string" ? raw.sku : undefined,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const firstName = String(shippingAddress?.firstName ?? "Cliente");
  const lastName = String(shippingAddress?.lastName ?? "");
  const id = `quote_${crypto.randomUUID().slice(0, 8)}`;
  const created = nowIso();

  return {
    id,
    quoteNumber: `QUO-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, "0")}`,
    customerName: `${firstName} ${lastName}`.trim(),
    customerEmail: String(payload.email ?? "cliente@protonlab.cl"),
    customerPhone: String(shippingAddress?.phone ?? ""),
    organization: String(shippingAddress?.addressLine1 ?? "Pendiente"),
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
  Object.assign(quote, {
    status: typeof payload.status === "string" ? payload.status : quote.status,
    vendorNotes: typeof payload.vendorNotes === "string" ? payload.vendorNotes : quote.vendorNotes,
    adminNotes: typeof payload.adminNotes === "string" ? payload.adminNotes : quote.adminNotes,
    rejectionReason: typeof payload.rejectionReason === "string" ? payload.rejectionReason : quote.rejectionReason,
    updatedAt: nowIso()
  });

  return ok({ quote }, request);
}

export async function approveQuote(request: Request, quoteId: string, level: "vendor" | "admin"): Promise<Response> {
  const quote = quotes.find((entry) => entry.id === quoteId || entry.quoteNumber === quoteId);
  if (!quote) return fail("Cotización no encontrada", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const approved = payload.approved !== false;
  const timestamp = nowIso();

  if (approved) {
    quote.status = level === "vendor" ? "aprobado_vendedor" : "aprobado";
    if (level === "vendor") quote.vendorApprovedAt = timestamp;
    if (level === "admin") quote.adminApprovedAt = timestamp;
  } else {
    quote.status = level === "vendor" ? "rechazado_vendedor" : "rechazado";
    quote.rejectionReason = String(payload.rejectionReason ?? "Sin motivo informado");
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

  const items = Array.isArray(payload.items) ? (payload.items as OrderItem[]) : [];
  const created = nowIso();
  const order: OperationOrder = {
    id: `order_${crypto.randomUUID().slice(0, 8)}`,
    orderNumber: `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`,
    customerName: String(payload.customerName ?? "Cliente"),
    customerEmail: String(payload.customerEmail ?? "cliente@protonlab.cl"),
    customerPhone: String(payload.customerPhone ?? ""),
    organization: String(payload.organization ?? ""),
    taxId: typeof payload.taxId === "string" ? payload.taxId : undefined,
    items,
    subtotal: Number(payload.subtotal ?? 0),
    discount: Number(payload.discount ?? 0),
    tax: Number(payload.tax ?? 0),
    shippingCost: Number(payload.shippingCost ?? 0),
    total: Number(payload.total ?? 0),
    status: "confirmado",
    paymentStatus: "pendiente",
    paymentMethod: typeof payload.paymentMethod === "string" ? payload.paymentMethod : "transferencia",
    shippingAddress: (payload.shippingAddress as ShippingAddress) ?? {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "Chile",
      phone: "",
      contactName: ""
    },
    createdAt: created,
    updatedAt: created
  };
  orders.unshift(order);
  return ok(order, request, 201);
}

export async function updateOrder(request: Request, orderId: string): Promise<Response> {
  const order = orders.find((entry) => entry.id === orderId || entry.orderNumber === orderId);
  if (!order) return fail("Pedido no encontrado", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  Object.assign(order, {
    status: typeof payload.status === "string" ? payload.status : order.status,
    paymentStatus: typeof payload.paymentStatus === "string" ? payload.paymentStatus : order.paymentStatus,
    trackingNumber: typeof payload.trackingNumber === "string" ? payload.trackingNumber : order.trackingNumber,
    updatedAt: nowIso()
  });

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

  const required = ["name", "email", "organization", "equipment", "comment"];
  if (required.some((key) => typeof payload[key] !== "string" || !String(payload[key]).trim())) {
    return fail("Payload de soporte inválido", { status: 400, code: "VALIDATION_ERROR", request });
  }

  const created = nowIso();
  const ticket: SupportTicket = {
    id: `ticket_${crypto.randomUUID().slice(0, 8)}`,
    ticketNumber: `SUP-${new Date().getFullYear()}-${String(supportTickets.length + 1).padStart(4, "0")}`,
    type: String(payload.type ?? "otro"),
    status: "nuevo",
    priority: "media",
    name: String(payload.name),
    organization: String(payload.organization),
    email: String(payload.email),
    phone: typeof payload.phone === "string" ? payload.phone : undefined,
    equipment: String(payload.equipment),
    serial: typeof payload.serial === "string" ? payload.serial : undefined,
    comment: String(payload.comment),
    createdAt: created,
    updatedAt: created
  };
  supportTickets.unshift(ticket);
  return ok({ ticket }, request, 201);
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
  if (typeof payload.status === "string") ticket.status = payload.status as SupportTicket["status"];
  if (typeof payload.priority === "string") ticket.priority = payload.priority as SupportTicket["priority"];
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
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="protonlab-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
