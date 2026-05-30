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
type UserRole = "socio" | "vendedor" | "admin" | "root" | "bodega" | "callcenter" | "soporte";
type PurchaseOrderStatus = "pendiente_aprobacion" | "aprobada" | "rechazada" | "facturada" | "cancelada";
type InvoiceStatus = "borrador" | "emitida" | "anulada";

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

export type RoleApproval = {
  role: UserRole;
  approved: boolean;
  approvedBy?: string;
  notes?: string;
  approvedAt: string;
};

export type PurchaseOrder = {
  id: string;
  purchaseOrderNumber: string;
  sourceOrderId: string;
  buyerReference?: string;
  requestedBy?: string;
  customerName: string;
  customerEmail: string;
  organization: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: PurchaseOrderStatus;
  approvals: RoleApproval[];
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  sourceOrderId: string;
  purchaseOrderId?: string;
  billingReference?: string;
  customerName: string;
  customerEmail: string;
  organization: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  issuedByRole: UserRole;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};

const nowIso = () => new Date().toISOString();
const makeDate = (day: number, hour = 12) => `2026-05-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

function makeItems(entries: Array<{ productIndex: number; quantity: number; unitPrice?: number }>): OrderItem[] {
  return entries.map((entry) => {
    const product = products[entry.productIndex] ?? products[0];
    const unitPrice = entry.unitPrice ?? product.price ?? (entry.productIndex + 1) * 1250;
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: entry.quantity,
      unitPrice,
      subtotal: unitPrice * entry.quantity
    };
  });
}

function totals(items: OrderItem[], options: { discount?: number; taxRate?: number; shippingCost?: number } = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = options.discount ?? 0;
  const shippingCost = options.shippingCost ?? 0;
  const tax = Math.round((subtotal - discount) * (options.taxRate ?? 0));

  return {
    subtotal,
    discount,
    tax,
    shippingCost,
    total: subtotal - discount + tax + shippingCost
  };
}

const orderItemsNexus = makeItems([
  { productIndex: 0, quantity: 1 },
  { productIndex: 2, quantity: 4 }
]);
const orderItemsQuantum = makeItems([{ productIndex: 1, quantity: 1 }]);
const orderItemsLab = makeItems([
  { productIndex: 3, quantity: 2, unitPrice: 12800 },
  { productIndex: 5, quantity: 8 }
]);
const orderItemsCulture = makeItems([
  { productIndex: 4, quantity: 2, unitPrice: 9600 },
  { productIndex: 5, quantity: 12 }
]);
const orderItemsStorage = makeItems([{ productIndex: 2, quantity: 10 }]);

const totalsNexus = totals(orderItemsNexus, { taxRate: 0.19, shippingCost: 280 });
const totalsQuantum = totals(orderItemsQuantum, { taxRate: 0.19, shippingCost: 0 });
const totalsLab = totals(orderItemsLab, { discount: 1500, taxRate: 0.19, shippingCost: 420 });
const totalsCulture = totals(orderItemsCulture, { taxRate: 0.19, shippingCost: 350 });
const totalsStorage = totals(orderItemsStorage, { discount: 500, taxRate: 0.19, shippingCost: 180 });

const orders: OperationOrder[] = [
  {
    id: "order-demo-1",
    orderNumber: "ORD-2026-0001",
    customerName: "María Valdés",
    customerEmail: "maria.valdes@andestech.cl",
    customerPhone: "+56 9 4123 7788",
    organization: "AndesTech Mining",
    taxId: "76.245.810-3",
    items: orderItemsNexus,
    ...totalsNexus,
    status: "procesando",
    paymentStatus: "parcial",
    paymentMethod: "transferencia",
    vendorId: "mock-vendedor",
    shippingAddress: {
      street: "Av. El Bosque Norte 0125",
      city: "Santiago",
      state: "RM",
      zipCode: "7550000",
      country: "Chile",
      phone: "+56 9 4123 7788",
      contactName: "María Valdés"
    },
    createdAt: makeDate(18, 9),
    updatedAt: makeDate(21, 16),
    confirmedAt: makeDate(18, 10)
  },
  {
    id: "order-demo-2",
    orderNumber: "ORD-2026-0002",
    customerName: "Rodrigo Fuentes",
    customerEmail: "rodrigo.fuentes@biolabnorte.cl",
    customerPhone: "+56 9 6622 1188",
    organization: "BioLab Norte",
    taxId: "77.918.220-8",
    items: orderItemsLab,
    ...totalsLab,
    status: "confirmado",
    paymentStatus: "pendiente",
    paymentMethod: "credito_30",
    vendorId: "mock-vendedor",
    shippingAddress: {
      street: "Parque Industrial La Negra 240",
      city: "Antofagasta",
      state: "Antofagasta",
      zipCode: "1240000",
      country: "Chile",
      phone: "+56 9 6622 1188",
      contactName: "Rodrigo Fuentes"
    },
    createdAt: makeDate(22, 11),
    updatedAt: makeDate(22, 11),
    confirmedAt: makeDate(22, 11)
  },
  {
    id: "order-demo-3",
    orderNumber: "ORD-2026-0003",
    customerName: "Camila Rojas",
    customerEmail: "camila.rojas@quantumclinic.cl",
    customerPhone: "+56 9 8877 6655",
    organization: "Quantum Clinic",
    taxId: "76.441.902-1",
    items: orderItemsQuantum,
    ...totalsQuantum,
    status: "enviado",
    paymentStatus: "pendiente",
    paymentMethod: "transferencia",
    vendorId: "mock-vendedor",
    trackingNumber: "PL-ENV-88391",
    shippingAddress: {
      street: "Av. Apoquindo 4501",
      city: "Las Condes",
      state: "RM",
      zipCode: "7580000",
      country: "Chile",
      phone: "+56 9 8877 6655",
      contactName: "Camila Rojas"
    },
    createdAt: makeDate(12, 15),
    updatedAt: makeDate(24, 10),
    confirmedAt: makeDate(12, 16),
    shippedAt: makeDate(24, 10)
  },
  {
    id: "order-demo-4",
    orderNumber: "ORD-2026-0004",
    customerName: "Ignacio Herrera",
    customerEmail: "ignacio.herrera@australresearch.cl",
    customerPhone: "+56 9 5544 2011",
    organization: "Austral Research Center",
    taxId: "78.105.330-5",
    items: orderItemsCulture,
    ...totalsCulture,
    status: "entregado",
    paymentStatus: "pagado",
    paymentMethod: "credito_60",
    vendorId: "mock-vendedor",
    trackingNumber: "PL-ENV-77122",
    shippingAddress: {
      street: "Camino a Niebla 398",
      city: "Valdivia",
      state: "Los Ríos",
      zipCode: "5090000",
      country: "Chile",
      phone: "+56 9 5544 2011",
      contactName: "Ignacio Herrera"
    },
    createdAt: makeDate(5, 9),
    updatedAt: makeDate(19, 17),
    confirmedAt: makeDate(5, 11),
    shippedAt: makeDate(17, 8),
    deliveredAt: makeDate(19, 17)
  },
  {
    id: "order-demo-5",
    orderNumber: "ORD-2026-0005",
    customerName: "Paula Méndez",
    customerEmail: "paula.mendez@redsaludtech.cl",
    customerPhone: "+56 9 3011 4455",
    organization: "RedSalud Tecnología",
    taxId: "79.822.140-6",
    items: orderItemsStorage,
    ...totalsStorage,
    status: "cancelado",
    paymentStatus: "reembolsado",
    paymentMethod: "tarjeta",
    vendorId: "mock-vendedor",
    shippingAddress: {
      street: "Av. Santa María 1850",
      city: "Providencia",
      state: "RM",
      zipCode: "7520000",
      country: "Chile",
      phone: "+56 9 3011 4455",
      contactName: "Paula Méndez"
    },
    createdAt: makeDate(3, 14),
    updatedAt: makeDate(4, 10),
    cancelledAt: makeDate(4, 10)
  }
];

const quotes: OperationQuote[] = [
  {
    id: "quote-demo-1",
    quoteNumber: "QUO-2026-0001",
    customerName: "Felipe Araya",
    customerEmail: "felipe.araya@metrologia.cl",
    customerPhone: "+56 9 7766 3322",
    organization: "Centro Nacional de Metrología",
    taxId: "70.145.200-9",
    items: makeItems([{ productIndex: 3, quantity: 1, unitPrice: 12800 }]),
    subtotal: 12800,
    discount: 0,
    tax: 2432,
    total: 15232,
    status: "pendiente",
    assignedSalesRep: "mock-vendedor",
    assignedSalesRepName: "Usuario Vendedor",
    createdAt: makeDate(27, 9),
    updatedAt: makeDate(27, 9)
  },
  {
    id: "quote-demo-2",
    quoteNumber: "QUO-2026-0002",
    customerName: "Valentina Muñoz",
    customerEmail: "valentina.munoz@roboticaeduca.cl",
    customerPhone: "+56 9 2233 4411",
    organization: "Robótica Educa",
    taxId: "76.998.120-4",
    items: makeItems([
      { productIndex: 0, quantity: 1 },
      { productIndex: 5, quantity: 20 }
    ]),
    subtotal: 47400,
    discount: 1200,
    tax: 8778,
    total: 54978,
    status: "aprobado_vendedor",
    assignedSalesRep: "mock-vendedor",
    assignedSalesRepName: "Usuario Vendedor",
    vendorNotes: "Cliente requiere instalación durante ventana de vacaciones de invierno.",
    vendorApprovedAt: makeDate(25, 15),
    createdAt: makeDate(24, 12),
    updatedAt: makeDate(25, 15)
  },
  {
    id: "quote-demo-3",
    quoteNumber: "QUO-2026-0003",
    customerName: "Sofía Carrasco",
    customerEmail: "sofia.carrasco@genomica-sur.cl",
    customerPhone: "+56 9 1010 7788",
    organization: "Genómica Sur",
    taxId: "77.601.440-1",
    items: makeItems([{ productIndex: 4, quantity: 4, unitPrice: 9600 }]),
    subtotal: 38400,
    discount: 0,
    tax: 7296,
    total: 45696,
    status: "aprobado",
    assignedSalesRep: "mock-vendedor",
    assignedSalesRepName: "Usuario Vendedor",
    vendorNotes: "Margen validado por ventas.",
    adminNotes: "Condición de pago aprobada por administración.",
    vendorApprovedAt: makeDate(20, 10),
    adminApprovedAt: makeDate(21, 12),
    createdAt: makeDate(19, 11),
    updatedAt: makeDate(21, 12)
  },
  {
    id: "quote-demo-4",
    quoteNumber: "QUO-2026-0004",
    customerName: "Cristóbal Lagos",
    customerEmail: "cristobal.lagos@neurodevices.cl",
    customerPhone: "+56 9 8899 1100",
    organization: "NeuroDevices SpA",
    taxId: "76.310.551-K",
    items: makeItems([{ productIndex: 1, quantity: 1 }]),
    subtotal: 150000,
    discount: 0,
    tax: 28500,
    total: 178500,
    status: "rechazado",
    assignedSalesRep: "mock-vendedor",
    assignedSalesRepName: "Usuario Vendedor",
    rejectionReason: "Presupuesto insuficiente para condiciones solicitadas.",
    createdAt: makeDate(10, 10),
    updatedAt: makeDate(13, 16)
  },
  {
    id: "quote-demo-5",
    quoteNumber: "QUO-2026-0005",
    customerName: "Ignacio Herrera",
    customerEmail: "ignacio.herrera@australresearch.cl",
    customerPhone: "+56 9 5544 2011",
    organization: "Austral Research Center",
    taxId: "78.105.330-5",
    items: orderItemsCulture,
    ...totalsCulture,
    status: "convertida",
    assignedSalesRep: "mock-vendedor",
    assignedSalesRepName: "Usuario Vendedor",
    vendorApprovedAt: makeDate(4, 12),
    adminApprovedAt: makeDate(5, 8),
    createdAt: makeDate(2, 16),
    updatedAt: makeDate(5, 9)
  }
];

const supportTickets: SupportTicket[] = [
  {
    id: "ticket-demo-1",
    ticketNumber: "SUP-2026-0001",
    type: "problema_tecnico",
    status: "en_progreso",
    priority: "alta",
    name: "María Valdés",
    organization: "AndesTech Mining",
    email: "maria.valdes@andestech.cl",
    phone: "+56 9 4123 7788",
    equipment: "Clúster de IA Nexus Server",
    serial: "NX-IA-00041",
    comment: "El cliente reporta alerta térmica intermitente durante cargas nocturnas.",
    createdAt: makeDate(26, 8),
    updatedAt: makeDate(27, 14)
  },
  {
    id: "ticket-demo-2",
    ticketNumber: "SUP-2026-0002",
    type: "mantenimiento_preventivo",
    status: "asignado",
    priority: "media",
    name: "Ignacio Herrera",
    organization: "Austral Research Center",
    email: "ignacio.herrera@australresearch.cl",
    phone: "+56 9 5544 2011",
    equipment: "Incubadora CO2 para Cultivos Celulares",
    serial: "CO2-AUS-177",
    comment: "Se solicita visita preventiva posterior a recepción e instalación.",
    createdAt: makeDate(23, 10),
    updatedAt: makeDate(24, 9)
  },
  {
    id: "ticket-demo-3",
    ticketNumber: "SUP-2026-0003",
    type: "demostracion",
    status: "nuevo",
    priority: "baja",
    name: "Valentina Muñoz",
    organization: "Robótica Educa",
    email: "valentina.munoz@roboticaeduca.cl",
    phone: "+56 9 2233 4411",
    equipment: "Clúster de IA Nexus Server",
    comment: "Requiere coordinación de demo remota antes de aprobar compra.",
    createdAt: makeDate(28, 11),
    updatedAt: makeDate(28, 11)
  }
];

const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po-demo-1",
    purchaseOrderNumber: "OC-2026-0001",
    sourceOrderId: "order-demo-1",
    buyerReference: "AT-OC-4588",
    requestedBy: "María Valdés",
    customerName: "María Valdés",
    customerEmail: "maria.valdes@andestech.cl",
    organization: "AndesTech Mining",
    items: orderItemsNexus,
    ...totalsNexus,
    status: "aprobada",
    approvals: [
      {
        role: "admin",
        approved: true,
        approvedBy: "Usuario Admin",
        notes: "OC aprobada contra presupuesto marco 2026.",
        approvedAt: makeDate(19, 15)
      }
    ],
    createdAt: makeDate(18, 12),
    updatedAt: makeDate(19, 15)
  },
  {
    id: "po-demo-2",
    purchaseOrderNumber: "OC-2026-0002",
    sourceOrderId: "order-demo-2",
    buyerReference: "BLN-OC-2201",
    requestedBy: "Rodrigo Fuentes",
    customerName: "Rodrigo Fuentes",
    customerEmail: "rodrigo.fuentes@biolabnorte.cl",
    organization: "BioLab Norte",
    items: orderItemsLab,
    ...totalsLab,
    status: "pendiente_aprobacion",
    approvals: [],
    createdAt: makeDate(22, 12),
    updatedAt: makeDate(22, 12)
  },
  {
    id: "po-demo-3",
    purchaseOrderNumber: "OC-2026-0003",
    sourceOrderId: "order-demo-3",
    buyerReference: "QC-OC-9002",
    requestedBy: "Camila Rojas",
    customerName: "Camila Rojas",
    customerEmail: "camila.rojas@quantumclinic.cl",
    organization: "Quantum Clinic",
    items: orderItemsQuantum,
    ...totalsQuantum,
    status: "facturada",
    approvals: [
      {
        role: "root",
        approved: true,
        approvedBy: "Usuario Root",
        notes: "Aprobación especial por monto crítico.",
        approvedAt: makeDate(14, 9)
      }
    ],
    createdAt: makeDate(13, 11),
    updatedAt: makeDate(15, 10)
  },
  {
    id: "po-demo-4",
    purchaseOrderNumber: "OC-2026-0004",
    sourceOrderId: "order-demo-5",
    buyerReference: "RST-OC-7781",
    requestedBy: "Paula Méndez",
    customerName: "Paula Méndez",
    customerEmail: "paula.mendez@redsaludtech.cl",
    organization: "RedSalud Tecnología",
    items: orderItemsStorage,
    ...totalsStorage,
    status: "rechazada",
    approvals: [
      {
        role: "admin",
        approved: false,
        approvedBy: "Usuario Admin",
        notes: "Solicitud anulada por cancelación de compra.",
        approvedAt: makeDate(4, 9)
      }
    ],
    createdAt: makeDate(3, 16),
    updatedAt: makeDate(4, 9)
  }
];

const invoices: Invoice[] = [
  {
    id: "inv-demo-1",
    invoiceNumber: "FAC-2026-0001",
    sourceOrderId: "order-demo-3",
    purchaseOrderId: "po-demo-3",
    billingReference: "QC-FAC-9002",
    customerName: "Camila Rojas",
    customerEmail: "camila.rojas@quantumclinic.cl",
    organization: "Quantum Clinic",
    items: orderItemsQuantum,
    ...totalsQuantum,
    status: "emitida",
    paymentStatus: "pendiente",
    issuedByRole: "root",
    issuedAt: makeDate(15, 10),
    createdAt: makeDate(15, 10),
    updatedAt: makeDate(15, 10)
  },
  {
    id: "inv-demo-2",
    invoiceNumber: "FAC-2026-0002",
    sourceOrderId: "order-demo-4",
    purchaseOrderId: undefined,
    billingReference: "ARC-FAC-3310",
    customerName: "Ignacio Herrera",
    customerEmail: "ignacio.herrera@australresearch.cl",
    organization: "Austral Research Center",
    items: orderItemsCulture,
    ...totalsCulture,
    status: "emitida",
    paymentStatus: "pagado",
    issuedByRole: "admin",
    issuedAt: makeDate(20, 10),
    createdAt: makeDate(20, 10),
    updatedAt: makeDate(23, 12)
  },
  {
    id: "inv-demo-3",
    invoiceNumber: "FAC-2026-0003",
    sourceOrderId: "order-demo-1",
    purchaseOrderId: "po-demo-1",
    billingReference: "AT-FAC-4588",
    customerName: "María Valdés",
    customerEmail: "maria.valdes@andestech.cl",
    organization: "AndesTech Mining",
    items: orderItemsNexus,
    ...totalsNexus,
    status: "borrador",
    paymentStatus: "parcial",
    issuedByRole: "admin",
    issuedAt: makeDate(22, 14),
    createdAt: makeDate(22, 14),
    updatedAt: makeDate(22, 14)
  }
];

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

function getRequestRole(request: Request, payload?: Record<string, unknown>): UserRole {
  const role = request.headers.get("x-user-role") ?? payload?.role ?? payload?.requestedByRole;
  const allowedRoles: readonly UserRole[] = ["socio", "vendedor", "admin", "root", "bodega", "callcenter", "soporte"];
  return parseAllowedValue(role ?? "socio", allowedRoles, "role") ?? "socio";
}

function assertRole(request: Request, role: UserRole, allowed: UserRole[]): Response | undefined {
  if (!allowed.includes(role)) {
    return fail("Rol no autorizado para esta operación", { status: 403, code: "FORBIDDEN", request });
  }

  return undefined;
}

function findOrderById(orderId: string): OperationOrder | undefined {
  return orders.find((entry) => entry.id === orderId || entry.orderNumber === orderId);
}

function findPurchaseOrderById(purchaseOrderId: string): PurchaseOrder | undefined {
  return purchaseOrders.find((entry) => entry.id === purchaseOrderId || entry.purchaseOrderNumber === purchaseOrderId);
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

export async function listPurchaseOrders(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sourceOrderId = url.searchParams.get("sourceOrderId");
  const customerEmail = url.searchParams.get("customerEmail");
  const filtered = purchaseOrders.filter(
    (purchaseOrder) =>
      matchesQuery(purchaseOrder.status, status) &&
      matchesQuery(purchaseOrder.sourceOrderId, sourceOrderId) &&
      matchesQuery(purchaseOrder.customerEmail, customerEmail)
  );

  return ok(paginate(filtered, request), request);
}

export async function createPurchaseOrder(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return fail("JSON inválido", { status: 400, code: "VALIDATION_ERROR", request });

  try {
    assertSafePayload(payload);
    const role = getRequestRole(request, payload);
    const forbidden = assertRole(request, role, ["socio", "vendedor", "admin", "root"]);
    if (forbidden) return forbidden;

    const sourceOrderId = sanitizeText(payload.sourceOrderId, {
      field: "sourceOrderId",
      required: true,
      maxLength: 120
    })!;
    const order = findOrderById(sourceOrderId);
    if (!order) return fail("Pedido base no encontrado", { status: 404, code: "NOT_FOUND", request });

    const created = nowIso();
    const purchaseOrder: PurchaseOrder = {
      id: `po_${crypto.randomUUID().slice(0, 8)}`,
      purchaseOrderNumber: `OC-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(4, "0")}`,
      sourceOrderId: order.id,
      buyerReference: sanitizeOptionalText(payload.buyerReference, "buyerReference", 120),
      requestedBy: sanitizeOptionalText(payload.requestedBy, "requestedBy", 120),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      organization: order.organization,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      shippingCost: order.shippingCost,
      total: order.total,
      status: "pendiente_aprobacion",
      approvals: [],
      createdAt: created,
      updatedAt: created
    };

    purchaseOrders.unshift(purchaseOrder);
    return ok(purchaseOrder, request, 201);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
}

export async function getPurchaseOrder(request: Request, purchaseOrderId: string): Promise<Response> {
  const purchaseOrder = findPurchaseOrderById(purchaseOrderId);
  if (!purchaseOrder) return fail("Orden de compra no encontrada", { status: 404, code: "NOT_FOUND", request });
  return ok(purchaseOrder, request);
}

export async function approvePurchaseOrder(request: Request, purchaseOrderId: string): Promise<Response> {
  const purchaseOrder = findPurchaseOrderById(purchaseOrderId);
  if (!purchaseOrder) return fail("Orden de compra no encontrada", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
    const role = getRequestRole(request, payload);
    const forbidden = assertRole(request, role, ["admin", "root"]);
    if (forbidden) return forbidden;

    const approved = payload.approved !== false;
    const timestamp = nowIso();
    const approval: RoleApproval = {
      role,
      approved,
      approvedBy: sanitizeOptionalText(payload.approvedBy, "approvedBy", 120),
      notes: sanitizeOptionalText(payload.notes, "notes", 500),
      approvedAt: timestamp
    };

    purchaseOrder.approvals = purchaseOrder.approvals.filter((item) => item.role !== role);
    purchaseOrder.approvals.push(approval);
    purchaseOrder.status = approved ? "aprobada" : "rechazada";
    purchaseOrder.updatedAt = timestamp;

    return ok(purchaseOrder, request);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
}

export async function listInvoices(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const paymentStatus = url.searchParams.get("paymentStatus");
  const sourceOrderId = url.searchParams.get("sourceOrderId");
  const filtered = invoices.filter(
    (invoice) =>
      matchesQuery(invoice.status, status) &&
      matchesQuery(invoice.paymentStatus, paymentStatus) &&
      matchesQuery(invoice.sourceOrderId, sourceOrderId)
  );

  return ok(paginate(filtered, request), request);
}

export async function createInvoice(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return fail("JSON inválido", { status: 400, code: "VALIDATION_ERROR", request });

  try {
    assertSafePayload(payload);
    const role = getRequestRole(request, payload);
    const forbidden = assertRole(request, role, ["admin", "root"]);
    if (forbidden) return forbidden;

    const sourceOrderId = sanitizeText(payload.sourceOrderId, {
      field: "sourceOrderId",
      required: true,
      maxLength: 120
    })!;
    const order = findOrderById(sourceOrderId);
    if (!order) return fail("Pedido base no encontrado", { status: 404, code: "NOT_FOUND", request });

    const purchaseOrderId = sanitizeOptionalText(payload.purchaseOrderId, "purchaseOrderId", 120);
    const purchaseOrder = purchaseOrderId ? findPurchaseOrderById(purchaseOrderId) : undefined;
    if (purchaseOrderId && !purchaseOrder) {
      return fail("Orden de compra no encontrada", { status: 404, code: "NOT_FOUND", request });
    }
    if (purchaseOrder && purchaseOrder.status !== "aprobada") {
      return fail("La orden de compra debe estar aprobada antes de facturar", {
        status: 409,
        code: "PURCHASE_ORDER_NOT_APPROVED",
        request
      });
    }

    const created = nowIso();
    const invoice: Invoice = {
      id: `inv_${crypto.randomUUID().slice(0, 8)}`,
      invoiceNumber: `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`,
      sourceOrderId: order.id,
      purchaseOrderId: purchaseOrder?.id,
      billingReference: sanitizeOptionalText(payload.billingReference, "billingReference", 120),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      organization: order.organization,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      shippingCost: order.shippingCost,
      total: order.total,
      status: "emitida",
      paymentStatus: "pendiente",
      issuedByRole: role,
      issuedAt: created,
      createdAt: created,
      updatedAt: created
    };

    invoices.unshift(invoice);
    if (purchaseOrder) {
      purchaseOrder.status = "facturada";
      purchaseOrder.updatedAt = created;
    }
    return ok(invoice, request, 201);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
}

export async function updateInvoice(request: Request, invoiceId: string): Promise<Response> {
  const invoice = invoices.find((entry) => entry.id === invoiceId || entry.invoiceNumber === invoiceId);
  if (!invoice) return fail("Factura no encontrada", { status: 404, code: "NOT_FOUND", request });

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    assertSafePayload(payload);
    const role = getRequestRole(request, payload);
    const forbidden = assertRole(request, role, ["admin", "root"]);
    if (forbidden) return forbidden;
    const paymentStatus = parseAllowedValue(payload.paymentStatus, PAYMENT_STATUSES, "paymentStatus");
    const status = parseAllowedValue(payload.status, ["borrador", "emitida", "anulada"] as const, "status");
    invoice.paymentStatus = paymentStatus ?? invoice.paymentStatus;
    invoice.status = status ?? invoice.status;
    invoice.updatedAt = nowIso();
    return ok(invoice, request);
  } catch (error) {
    const response = failValidation(error, request);
    if (response) return response;
    throw error;
  }
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
    ...purchaseOrders.map((purchaseOrder) => [
      "purchase_order",
      purchaseOrder.id,
      purchaseOrder.status,
      purchaseOrder.customerEmail,
      purchaseOrder.createdAt,
      purchaseOrder.updatedAt
    ]),
    ...invoices.map((invoice) => [
      "invoice",
      invoice.id,
      invoice.status,
      invoice.customerEmail,
      invoice.createdAt,
      invoice.updatedAt
    ]),
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
