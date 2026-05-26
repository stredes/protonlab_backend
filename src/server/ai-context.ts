import type { Role } from "../models/user";

type EntityField = {
  name: string;
  type: string;
  description: string;
};

type ContextEntity = {
  name: string;
  kind: "sql_table" | "firestore_collection" | "blob_prefix" | "auth_claims";
  description: string;
  fields: EntityField[];
  relations?: string[];
  readRoles: Role[];
  notes?: string[];
};

type ContextRegistry = {
  version: string;
  product: string;
  operatingMode: string[];
  entities: ContextEntity[];
  rolePolicies: Array<{
    role: Role;
    scope: string;
  }>;
};

export const protonLabAiContextRegistry: ContextRegistry = {
  version: "2026-05-26",
  product: "ERP ProtonLab",
  operatingMode: [
    "Usar el catálogo como fuente primaria de nombres de entidades y campos.",
    "Responder solo consultas de lectura; nunca modificar datos.",
    "Si una pregunta requiere datos crudos Firestore o Blob, declarar el supuesto en assumptions.",
    "Priorizar métricas operativas de cotizaciones, pedidos, inventario, usuarios, soporte e imágenes."
  ],
  entities: [
    {
      name: "orders",
      kind: "sql_table",
      description: "Pedidos del ERP creados desde cotizaciones o flujo comercial.",
      fields: [
        { name: "id", type: "string", description: "Identificador interno del pedido." },
        { name: "orderNumber", type: "string", description: "Folio visible del pedido." },
        { name: "userId", type: "string", description: "UID Firebase del cliente, si existe." },
        { name: "customerName", type: "string", description: "Nombre del cliente." },
        { name: "customerEmail", type: "string", description: "Correo del cliente." },
        { name: "organization", type: "string", description: "Empresa u organización cliente." },
        { name: "items", type: "array", description: "Productos, cantidades, SKU, precio unitario y subtotal." },
        { name: "subtotal", type: "number", description: "Subtotal antes de impuestos/descuentos/despacho." },
        { name: "discount", type: "number", description: "Descuento aplicado." },
        { name: "tax", type: "number", description: "Impuesto aplicado." },
        { name: "shippingCost", type: "number", description: "Costo de despacho." },
        { name: "total", type: "number", description: "Total del pedido." },
        { name: "status", type: "enum", description: "cotizacion, pendiente_vendedor, aprobado_vendedor, pendiente_admin, aprobado_admin, rechazado, confirmado, procesando, enviado, entregado, cancelado." },
        { name: "paymentStatus", type: "enum", description: "pendiente, parcial, pagado, reembolsado." },
        { name: "vendorId", type: "string", description: "Vendedor asignado." },
        { name: "createdAt", type: "datetime", description: "Fecha de creación." },
        { name: "updatedAt", type: "datetime", description: "Última actualización." }
      ],
      relations: [
        "orders.userId -> users.id",
        "orders.vendorId -> users.id",
        "orders.items.productId -> products.id"
      ],
      readRoles: ["root", "admin", "vendedor", "bodega", "callcenter", "soporte"],
      notes: ["Para conteos por estado usar status.", "Para ingresos usar total."]
    },
    {
      name: "quotes",
      kind: "sql_table",
      description: "Cotizaciones comerciales antes de convertirse en pedido.",
      fields: [
        { name: "id", type: "string", description: "Identificador interno de la cotización." },
        { name: "quoteNumber", type: "string", description: "Folio visible de cotización." },
        { name: "userId", type: "string", description: "UID Firebase del cliente, si existe." },
        { name: "customerName", type: "string", description: "Nombre del cliente." },
        { name: "customerEmail", type: "string", description: "Correo del cliente." },
        { name: "organization", type: "string", description: "Empresa u organización cliente." },
        { name: "items", type: "array", description: "Productos cotizados." },
        { name: "subtotal", type: "number", description: "Subtotal." },
        { name: "discount", type: "number", description: "Descuento." },
        { name: "tax", type: "number", description: "Impuesto." },
        { name: "total", type: "number", description: "Total cotizado." },
        { name: "status", type: "enum", description: "pendiente, en_revision_vendedor, aprobado_vendedor, rechazado_vendedor, en_revision_admin, aprobado, rechazado, convertida." },
        { name: "assignedSalesRep", type: "string", description: "UID del vendedor asignado." },
        { name: "vendorNotes", type: "string", description: "Notas del vendedor." },
        { name: "adminNotes", type: "string", description: "Notas administrativas." },
        { name: "createdAt", type: "datetime", description: "Fecha de creación." },
        { name: "updatedAt", type: "datetime", description: "Última actualización." }
      ],
      relations: [
        "quotes.assignedSalesRep -> users.id",
        "quotes.items.productId -> products.id"
      ],
      readRoles: ["root", "admin", "vendedor", "callcenter", "soporte"]
    },
    {
      name: "products",
      kind: "sql_table",
      description: "Catálogo de productos ProtonLab usado para cotizaciones y pedidos.",
      fields: [
        { name: "id", type: "string", description: "Identificador del producto." },
        { name: "sku", type: "string", description: "SKU comercial." },
        { name: "name", type: "string", description: "Nombre del producto." },
        { name: "category", type: "string", description: "Categoría." },
        { name: "price", type: "number", description: "Precio." },
        { name: "image", type: "url", description: "Imagen primaria." },
        { name: "hoverImage", type: "url", description: "Imagen secundaria." },
        { name: "stock", type: "number", description: "Inventario disponible si el origen lo expone." }
      ],
      relations: ["products.id -> orders.items.productId", "products.id -> quotes.items.productId", "products.id -> productImages.productId"],
      readRoles: ["root", "admin", "vendedor", "bodega", "callcenter", "soporte", "cliente"]
    },
    {
      name: "users",
      kind: "auth_claims",
      description: "Usuarios Firebase y claims operativos.",
      fields: [
        { name: "id", type: "string", description: "Firebase UID." },
        { name: "email", type: "string", description: "Correo." },
        { name: "name", type: "string", description: "Nombre visible." },
        { name: "role", type: "enum", description: "root, admin, socio, vendedor, bodega, callcenter, soporte, cliente." },
        { name: "company", type: "string", description: "Empresa asociada." },
        { name: "vendorId", type: "string", description: "Vendedor asociado." },
        { name: "isActive", type: "boolean", description: "Estado de activación." }
      ],
      readRoles: ["root", "admin"]
    },
    {
      name: "supportTickets",
      kind: "sql_table",
      description: "Tickets de soporte y postventa.",
      fields: [
        { name: "id", type: "string", description: "Identificador del ticket." },
        { name: "ticketNumber", type: "string", description: "Folio visible." },
        { name: "type", type: "enum", description: "preventa, demostracion, problema_tecnico, mantenimiento_preventivo, otro." },
        { name: "status", type: "enum", description: "nuevo, asignado, en_progreso, resuelto, cerrado." },
        { name: "priority", type: "enum", description: "baja, media, alta." },
        { name: "name", type: "string", description: "Solicitante." },
        { name: "organization", type: "string", description: "Organización solicitante." },
        { name: "email", type: "string", description: "Correo." },
        { name: "equipment", type: "string", description: "Equipo relacionado." },
        { name: "createdAt", type: "datetime", description: "Fecha de creación." },
        { name: "updatedAt", type: "datetime", description: "Última actualización." }
      ],
      readRoles: ["root", "admin", "soporte", "callcenter"]
    },
    {
      name: "firestoreRaw",
      kind: "firestore_collection",
      description: "Acceso administrativo read-only a colecciones Firestore crudas.",
      fields: [
        { name: "collection", type: "string", description: "Nombre de colección raíz." },
        { name: "documents", type: "array", description: "Documentos serializados." },
        { name: "path", type: "string", description: "Ruta Firestore del documento." }
      ],
      readRoles: ["root", "admin"],
      notes: ["No consultar subrutas arbitrarias sin validar permisos.", "Usar solo para inspección administrativa."]
    },
    {
      name: "productImages",
      kind: "blob_prefix",
      description: "Imágenes de productos en Vercel Blob.",
      fields: [
        { name: "productId", type: "string", description: "Producto dueño de la imagen." },
        { name: "variant", type: "enum", description: "primary o hover." },
        { name: "pathname", type: "string", description: "Ruta products/{productId}/{variant}-..." },
        { name: "url", type: "url", description: "URL pública de Vercel Blob." },
        { name: "uploadedAt", type: "datetime", description: "Fecha de subida si Blob la expone." }
      ],
      relations: ["productImages.productId -> products.id"],
      readRoles: ["root", "admin", "vendedor", "bodega"]
    }
  ],
  rolePolicies: [
    { role: "root", scope: "Puede inspeccionar todo el ecosistema, incluyendo usuarios y data cruda." },
    { role: "admin", scope: "Puede consultar operación, usuarios, Firestore raw, Blob e IA SQL." },
    { role: "vendedor", scope: "Puede consultar cotizaciones, pedidos y catálogo relacionados a ventas." },
    { role: "bodega", scope: "Puede consultar pedidos, productos, inventario e imágenes de producto." },
    { role: "callcenter", scope: "Puede consultar pedidos, cotizaciones y tickets necesarios para atención." },
    { role: "soporte", scope: "Puede consultar tickets, pedidos relacionados y datos mínimos de cliente." },
    { role: "cliente", scope: "Solo puede consultar su propia información cuando el endpoint lo permita." },
    { role: "socio", scope: "Rol interno limitado; requiere reglas explícitas por endpoint." }
  ]
};

function formatFields(fields: EntityField[]): string {
  return fields
    .map((field) => `${field.name}:${field.type} (${field.description})`)
    .join(", ");
}

export function buildAiContextRegistryPrompt(): string {
  const entityLines = protonLabAiContextRegistry.entities.map((entity) => {
    const parts = [
      `- ${entity.name} [${entity.kind}]: ${entity.description}`,
      `  Campos: ${formatFields(entity.fields)}`,
      `  Roles lectura: ${entity.readRoles.join(", ")}`
    ];

    if (entity.relations?.length) {
      parts.push(`  Relaciones: ${entity.relations.join("; ")}`);
    }

    if (entity.notes?.length) {
      parts.push(`  Notas: ${entity.notes.join(" ")}`);
    }

    return parts.join("\n");
  });

  const policies = protonLabAiContextRegistry.rolePolicies.map(
    (policy) => `- ${policy.role}: ${policy.scope}`
  );

  return [
    `Catálogo operativo ProtonLab (${protonLabAiContextRegistry.version})`,
    `Producto: ${protonLabAiContextRegistry.product}`,
    "Modo de operación:",
    ...protonLabAiContextRegistry.operatingMode.map((item) => `- ${item}`),
    "Entidades disponibles:",
    ...entityLines,
    "Reglas de acceso por rol:",
    ...policies
  ].join("\n");
}
