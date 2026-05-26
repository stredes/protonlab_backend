#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type SeedProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  family: string;
  categoryId: string;
  availability: "disponible" | "bajo_pedido" | "sujeto_stock";
  price: number;
  stock: number;
  image: string;
  shortDescription: string;
};

const categories = [
  {
    id: "cat-equipos",
    name: "Equipos Clinicos",
    slug: "equipos",
    description: "Equipamiento de laboratorio, diagnostico y automatizacion.",
    image: "/src/assets/images/protonlab/equipos-clinicos.png",
    href: "/productos?categoryId=cat-equipos"
  },
  {
    id: "cat-reactivos",
    name: "Reactivos",
    slug: "reactivos",
    description: "Reactivos, controles y consumibles para laboratorio clinico.",
    image: "/src/assets/images/protonlab/microbiologia.png",
    href: "/productos?categoryId=cat-reactivos"
  },
  {
    id: "cat-insumos",
    name: "Insumos",
    slug: "insumos",
    description: "Insumos recurrentes para toma, preparacion y procesamiento de muestras.",
    image: "/src/assets/images/protonlab/hematologia.png",
    href: "/productos?categoryId=cat-insumos"
  },
  {
    id: "cat-ia",
    name: "IA y Automatizacion",
    slug: "ia-automatizacion",
    description: "Hardware y estaciones inteligentes para analitica avanzada.",
    image: "/src/assets/images/protonlab/ai_hardware_1777123776193.png",
    href: "/productos?categoryId=cat-ia"
  }
];

const products: SeedProduct[] = [
  ["prod-autohematology-x5", "HEM-X5-001", "analizador-hematologico-x5", "Analizador Hematologico X5", "HemaCore", "Hematologia", "cat-equipos", "disponible", 24800, 6, "hematologia.png", "Analizador de 5 diferenciales para laboratorios de mediana demanda."],
  ["prod-chemistry-c200", "QUI-C200-002", "analizador-quimica-c200", "Analizador de Quimica Clinica C200", "BioMetric", "Quimica Clinica", "cat-equipos", "disponible", 31500, 4, "equipos-clinicos.png", "Equipo automatizado para perfiles bioquimicos y controles de rutina."],
  ["prod-electrolyte-e8", "ELE-E8-003", "analizador-electrolitos-e8", "Analizador de Electrolitos E8", "IonLab", "Electrolitos", "cat-equipos", "sujeto_stock", 8900, 2, "electrolitos.png", "Medicion rapida de Na, K, Cl, Ca y pH con bajo volumen de muestra."],
  ["prod-urine-u500", "URI-U500-004", "lector-orinas-u500", "Lector de Orinas U500", "UriScan", "Uroanalisis", "cat-equipos", "disponible", 4200, 10, "orinas.png", "Lector semiautomatico para tiras reactivas de orina."],
  ["prod-microbio-mx", "MIC-MX-005", "cabina-microbiologia-mx", "Cabina Microbiologica MX", "SafeLab", "Microbiologia", "cat-equipos", "bajo_pedido", 12600, 1, "microbiologia.png", "Cabina de bioseguridad para preparacion de muestras microbiologicas."],
  ["prod-tbc-rapid", "TBC-RAP-006", "kit-tbc-rapid", "Kit TBC Rapid x25", "DiagFast", "TBC", "cat-reactivos", "disponible", 380, 80, "tbc.png", "Kit rapido para apoyo diagnostico de tuberculosis."],
  ["prod-reactive-glucose", "REA-GLU-007", "reactivo-glucosa-500", "Reactivo Glucosa 500 Tests", "BioMetric", "Reactivos", "cat-reactivos", "disponible", 210, 120, "microbiologia.png", "Reactivo de glucosa para analizador de quimica clinica."],
  ["prod-reactive-creatinine", "REA-CRE-008", "reactivo-creatinina-400", "Reactivo Creatinina 400 Tests", "BioMetric", "Reactivos", "cat-reactivos", "disponible", 260, 95, "microbiologia.png", "Reactivo para medicion de creatinina serica y urinaria."],
  ["prod-control-hematology", "CTRL-HEM-009", "control-hematologico-trinivel", "Control Hematologico Trinivel", "HemaCore", "Controles", "cat-reactivos", "sujeto_stock", 180, 35, "hematologia.png", "Control de calidad trinivel para validacion hematologica."],
  ["prod-tubes-vacuum", "INS-TUB-010", "tubos-vacio-edta-x1000", "Tubos al Vacio EDTA x1000", "GlassMed", "Insumos", "cat-insumos", "disponible", 145, 200, "orinas.png", "Tubos para toma de muestra con anticoagulante EDTA."],
  ["prod-pipette-tips", "INS-PUN-011", "puntas-pipeta-esteriles-x960", "Puntas de Pipeta Esteriles x960", "MicroTip", "Insumos", "cat-insumos", "disponible", 58, 260, "microbiologia.png", "Puntas universales esteriles para pipetas automaticas."],
  ["prod-centrifuge-c12", "EQ-CEN-012", "centrifuga-clinica-c12", "Centrifuga Clinica C12", "SpinLab", "Equipos", "cat-equipos", "disponible", 3200, 5, "equipos-clinicos.png", "Centrifuga compacta para tubos clinicos y procesamiento diario."],
  ["prod-incubator-co2", "EQ-INC-013", "incubadora-co2-cultivos", "Incubadora CO2 para Cultivos", "TermoLab", "Equipos", "cat-equipos", "bajo_pedido", 11200, 1, "equipos-clinicos.png", "Incubadora de CO2 con control fino de humedad y temperatura."],
  ["prod-microscope-hd", "EQ-MIC-014", "microscopio-fluorescencia-hd", "Microscopio de Fluorescencia HD", "OptiSci", "Equipos", "cat-equipos", "disponible", 9800, 3, "microbiologia.png", "Microscopio HD para analisis de muestras y docencia."],
  ["prod-ai-cluster-nexus", "AI-NEX-015", "cluster-ia-nexus-server", "Cluster IA Nexus Server", "Nexus", "IA", "cat-ia", "bajo_pedido", 45000, 1, "ai_hardware_1777123776193.png", "Servidor GPU para entrenamiento y analitica avanzada."],
  ["prod-edge-box-k4", "AI-EDG-016", "edge-box-k4-laboratorio", "Edge Box K4 Laboratorio", "Nexus", "IA", "cat-ia", "disponible", 6800, 7, "tech_hardware_1777091078472.png", "Nodo edge para integracion de equipos y telemetria local."],
  ["prod-robot-arm-r7", "ROB-R7-017", "brazo-robotico-r7", "Brazo Robotico R7", "RoboLab", "Robotica", "cat-ia", "sujeto_stock", 22000, 2, "tech_robot_1777091060991.png", "Brazo colaborativo para automatizacion de procesos repetitivos."],
  ["prod-nanobot-kit", "NAN-KIT-018", "kit-nanobots-educativo", "Kit Nanobots Educativo", "NanoLab", "Nanotecnologia", "cat-ia", "disponible", 1250, 18, "tech_nanotech_1777091090503.png", "Kit demostrativo para investigacion y capacitacion aplicada."]
].map(([id, sku, slug, name, brand, family, categoryId, availability, price, stock, image, shortDescription]) => ({
  id,
  sku,
  slug,
  name,
  brand,
  family,
  categoryId,
  availability,
  price,
  stock,
  currency: "USD",
  image: `/src/assets/images/protonlab/${image}`,
  href: `/productos/${slug}`,
  requiresInstallation: family === "Equipos" || family === "IA" || family === "Robotica",
  requiresMaintenance: family === "Equipos" || family === "IA" || family === "Robotica",
  shortDescription
} as SeedProduct));

const customers = [
  { id: "demo-cliente-hospital-norte", name: "Hospital Norte", email: "compras@hospitalnorte.cl", phone: "+56 9 4100 1001", taxId: "76.100.200-1" },
  { id: "demo-cliente-lab-andes", name: "Laboratorio Clinico Andes", email: "operaciones@labandes.cl", phone: "+56 9 4100 1002", taxId: "77.300.400-2" },
  { id: "demo-cliente-universidad-sur", name: "Universidad Sur Biomedica", email: "investigacion@universidadsur.cl", phone: "+56 9 4100 1003", taxId: "75.900.111-3" },
  { id: "demo-cliente-clinica-valle", name: "Clinica Valle Central", email: "abastecimiento@clinicavalle.cl", phone: "+56 9 4100 1004", taxId: "78.450.222-4" }
];

const salesReps = [
  { id: "demo-vendedor-camila", name: "Camila Rojas", email: "camila.rojas@protonlab.cl" },
  { id: "demo-vendedor-martin", name: "Martin Fuentes", email: "martin.fuentes@protonlab.cl" }
];

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = key === "FIREBASE_PRIVATE_KEY" ? value.replace(/\\n/g, "\n") : value;
  }
}

function initFirebase() {
  if (getApps().length > 0) return;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }

  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

function item(productIndex: number, quantity: number) {
  const product = products[productIndex % products.length];
  return {
    productId: product.id,
    productName: product.name,
    name: product.name,
    sku: product.sku,
    quantity,
    unitPrice: product.price,
    price: product.price,
    subtotal: product.price * quantity
  };
}

function totals(items: ReturnType<typeof item>[], discountRate = 0) {
  const subtotal = items.reduce((sum, entry) => sum + entry.subtotal, 0);
  const discount = Math.round(subtotal * discountRate);
  const tax = Math.round((subtotal - discount) * 0.19);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function buildQuotes() {
  const statuses = ["pendiente", "en_revision_vendedor", "aprobado_vendedor", "en_revision_admin", "aprobado", "rechazado", "convertida"] as const;
  return Array.from({ length: 14 }, (_, index) => {
    const customer = customers[index % customers.length];
    const rep = salesReps[index % salesReps.length];
    const quoteItems = [item(index, 1 + (index % 3)), item(index + 4, 2)];
    const quoteTotals = totals(quoteItems, index % 4 === 0 ? 0.08 : 0);
    return {
      id: `demo-quote-${String(index + 1).padStart(3, "0")}`,
      quoteNumber: `QUO-2026-${String(index + 1).padStart(4, "0")}`,
      userId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      organization: customer.name,
      taxId: customer.taxId,
      items: quoteItems,
      ...quoteTotals,
      totalAmount: quoteTotals.total,
      status: statuses[index % statuses.length],
      assignedSalesRep: rep.id,
      assignedSalesRepName: rep.name,
      vendorNotes: index % 2 === 0 ? "Cliente solicita despacho programado y capacitacion inicial." : "",
      adminNotes: index % 5 === 0 ? "Validar margen antes de aprobacion final." : "",
      createdAt: daysAgo(18 - index),
      updatedAt: daysAgo(17 - index),
      seedTag: "demo-erp-2026"
    };
  });
}

function buildOrders() {
  const statuses = ["confirmado", "procesando", "enviado", "entregado", "pendiente_admin", "aprobado_admin", "cancelado"] as const;
  const paymentStatuses = ["pendiente", "parcial", "pagado"] as const;
  return Array.from({ length: 18 }, (_, index) => {
    const customer = customers[index % customers.length];
    const orderItems = [item(index + 2, 1 + (index % 2)), item(index + 7, 1)];
    const orderTotals = totals(orderItems, index % 6 === 0 ? 0.05 : 0);
    const createdAt = daysAgo(24 - index);
    return {
      id: `demo-order-${String(index + 1).padStart(3, "0")}`,
      orderNumber: `ORD-2026-${String(index + 1).padStart(4, "0")}`,
      userId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      organization: customer.name,
      taxId: customer.taxId,
      items: orderItems,
      ...orderTotals,
      totalAmount: orderTotals.total,
      status: statuses[index % statuses.length],
      paymentStatus: paymentStatuses[index % paymentStatuses.length],
      paymentMethod: index % 3 === 0 ? "transferencia" : "credito_empresa",
      vendorId: salesReps[index % salesReps.length].id,
      shippingAddress: {
        street: `Av. Demo ${1200 + index}`,
        city: index % 2 === 0 ? "Santiago" : "Valparaiso",
        state: index % 2 === 0 ? "RM" : "Valparaiso",
        zipCode: "7500000",
        country: "Chile",
        phone: customer.phone,
        contactName: customer.name
      },
      trackingNumber: index % 3 === 0 ? `TRK-DEMO-${10000 + index}` : "",
      createdAt,
      updatedAt: daysAgo(23 - index),
      confirmedAt: createdAt,
      shippedAt: index % 3 === 0 ? daysAgo(20 - index) : "",
      deliveredAt: statuses[index % statuses.length] === "entregado" ? daysAgo(18 - index) : "",
      seedTag: "demo-erp-2026"
    };
  });
}

function buildTickets() {
  const statuses = ["nuevo", "asignado", "en_progreso", "resuelto", "cerrado"] as const;
  const priorities = ["baja", "media", "alta"] as const;
  const types = ["preventa", "demostracion", "problema_tecnico", "mantenimiento_preventivo", "otro"] as const;
  return Array.from({ length: 12 }, (_, index) => {
    const customer = customers[index % customers.length];
    const product = products[(index + 3) % products.length];
    return {
      id: `demo-ticket-${String(index + 1).padStart(3, "0")}`,
      ticketNumber: `SUP-2026-${String(index + 1).padStart(4, "0")}`,
      type: types[index % types.length],
      status: statuses[index % statuses.length],
      priority: priorities[index % priorities.length],
      name: customer.name,
      organization: customer.name,
      email: customer.email,
      phone: customer.phone,
      equipment: product.name,
      serial: `SN-DEMO-${product.sku}-${100 + index}`,
      comment: index % 2 === 0
        ? "Solicitan revision preventiva y confirmacion de disponibilidad de repuestos."
        : "Cliente requiere apoyo remoto para configuracion y puesta en marcha.",
      createdAt: daysAgo(10 - (index % 8)),
      updatedAt: daysAgo(9 - (index % 8)),
      seedTag: "demo-erp-2026"
    };
  });
}

async function setAll(collectionName: string, docs: Array<{ id: string; [key: string]: unknown }>) {
  const db = getFirestore();
  for (const document of docs) {
    await db.collection(collectionName).doc(document.id).set(
      {
        ...document,
        updatedAt: document.updatedAt ?? FieldValue.serverTimestamp(),
        demoSeed: true
      },
      { merge: true }
    );
  }
  console.log(`OK ${collectionName}: ${docs.length}`);
}

async function main() {
  loadEnvFile();
  initFirebase();

  await setAll("categories", categories);
  await setAll("products", products.map((product) => ({
    ...product,
    currency: "USD",
    isActive: true,
    imageUrl: product.image,
    images: [product.image],
    searchKeywords: product.name.toLowerCase().split(/\s+/),
    createdAt: FieldValue.serverTimestamp()
  })));
  await setAll("users", [
    ...customers.map((customer) => ({
      uid: customer.id,
      id: customer.id,
      email: customer.email,
      displayName: customer.name,
      role: "cliente",
      isActive: true,
      companyData: { businessName: customer.name, rut: customer.taxId, industry: "Salud" },
      createdAt: FieldValue.serverTimestamp()
    })),
    ...salesReps.map((rep) => ({
      uid: rep.id,
      id: rep.id,
      email: rep.email,
      displayName: rep.name,
      role: "vendedor",
      isActive: true,
      createdAt: FieldValue.serverTimestamp()
    }))
  ]);
  await setAll("quotes", buildQuotes());
  await setAll("orders", buildOrders());
  await setAll("support_tickets", buildTickets());
  await setAll("carts", customers.map((customer, index) => ({
    id: customer.id,
    userId: customer.id,
    updatedAt: daysAgo(index),
    items: [item(index, 2), item(index + 6, 1)],
    seedTag: "demo-erp-2026"
  })));
  await setAll("inventory_movements", products.slice(0, 12).map((product, index) => ({
    id: `demo-inventory-${String(index + 1).padStart(3, "0")}`,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    type: index % 3 === 0 ? "salida" : "entrada",
    quantity: index % 3 === 0 ? 1 + index : 8 + index,
    reason: index % 3 === 0 ? "Orden demo" : "Reposicion demo",
    createdAt: daysAgo(14 - index),
    seedTag: "demo-erp-2026"
  })));
  await setAll("audit_logs", [
    { id: "demo-audit-seed", action: "DEMO_SEED_APPLIED", actor: "script", createdAt: FieldValue.serverTimestamp(), details: "Carga de datos demo ERP ProtonLab." },
    { id: "demo-audit-ai", action: "AI_ASSISTANT_VALIDATED", actor: "admin", createdAt: FieldValue.serverTimestamp(), details: "Agente validado para conteos de usuarios y productos." }
  ]);

  console.log("Seed demo completada. Puedes refrescar frontend y probar la IA.");
}

main().catch((error) => {
  console.error("Error ejecutando seed demo:", error);
  process.exit(1);
});
