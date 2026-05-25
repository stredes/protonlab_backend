#!/usr/bin/env node
/**
 * seedFirestore.ts
 *
 * Migra los productos y categorías hardcodeados a Firebase Firestore.
 *
 * USO (elige una de las opciones):
 *
 *   Opción A — Con tsx (recomendado):
 *     npx tsx scripts/seedFirestore.ts
 *
 *   Opción B — Con ts-node en modo ESM:
 *     node --import tsx/esm scripts/seedFirestore.ts
 *
 * REQUISITOS:
 *   Coloca tu archivo serviceAccountKey.json en la raíz de protonlab_backend/
 *   (descárgalo desde Firebase Console > Project Settings > Service Accounts)
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Datos del catálogo (inlined para evitar problemas de resolución de módulos) ─

const categories = [
  {
    id: 'cat-equipos',
    name: 'Robótica',
    slug: 'equipos',
    image: '/src/assets/images/protonlab/tech_robot_1777091060991.png',
    href: '/shop?category=equipos',
  },
  {
    id: 'cat-reactivos',
    name: 'Hardware',
    slug: 'reactivos',
    image: '/src/assets/images/protonlab/tech_hardware_1777091078472.png',
    href: '/shop?category=reactivos',
  },
  {
    id: 'cat-insumos',
    name: 'Nanobots',
    slug: 'insumos',
    image: '/src/assets/images/protonlab/tech_nanotech_1777091090503.png',
    href: '/shop?category=insumos',
  },
];

const products = [
  {
    id: 'prod-hardware-ia',
    sku: 'HW-IA-001',
    slug: 'cluster-ia-nexus',
    name: 'Clúster de IA Nexus Server',
    brand: 'Nexus',
    family: 'Equipos',
    availability: 'disponible',
    requiresInstallation: true,
    requiresMaintenance: true,
    price: 45000,
    currency: 'USD',
    image: '/product-images/cluster-ia-nexus.jpg',
    hoverImage: '/product-images/cluster-ia-nexus.jpg',
    categoryId: 'cat-equipos',
    href: '/productos/cluster-ia-nexus',
    badge: { text: 'Destacado', className: 'new-badge' },
    shortDescription: 'Servidor empresarial avanzado para entrenamiento de modelos de inteligencia artificial.',
    technicalDescription: 'GPUs de última generación, refrigeración líquida y escalabilidad modular.',
  },
  {
    id: 'prod-procesador-cuantico',
    sku: 'HW-QC-002',
    slug: 'procesador-cuantico-qcore',
    name: 'Procesador Cuántico Q-Core',
    brand: 'QuantumTech',
    family: 'Componentes',
    availability: 'bajo_pedido',
    requiresInstallation: true,
    requiresMaintenance: true,
    price: 150000,
    currency: 'USD',
    image: '/product-images/procesador-cuantico-qcore.jpg',
    categoryId: 'cat-equipos',
    href: '/productos/procesador-cuantico-qcore',
    shortDescription: 'Procesador cuántico para simulaciones moleculares, optimización avanzada y criptografía.',
  },
  {
    id: 'prod-ssd-vanguardia',
    sku: 'HW-SSD-003',
    slug: 'ssd-nvme-neo-force',
    name: 'SSD NVMe Neo-Force PCIe 5.0',
    brand: 'NeoStorage',
    family: 'Componentes',
    availability: 'sujeto_stock',
    requiresInstallation: false,
    requiresMaintenance: false,
    price: 850,
    currency: 'USD',
    image: '/product-images/ssd-nvme-neo-force.jpg',
    categoryId: 'cat-insumos',
    href: '/productos/ssd-nvme-neo-force',
    badge: { text: 'Nuevo', className: 'offer-badge' },
  },
  {
    id: 'prod-microscopio',
    sku: 'EQ-MIC-004',
    slug: 'microscopio-fluorescencia',
    name: 'Microscopio de Fluorescencia HD',
    brand: 'OptiSci',
    family: 'Equipos',
    availability: 'disponible',
    requiresInstallation: true,
    requiresMaintenance: true,
    image: '/product-images/microscopio-fluorescencia.jpg',
    categoryId: 'cat-equipos',
    href: '/productos/microscopio-fluorescencia',
    shortDescription: 'Microscopio de alta resolución para análisis de muestras y procesos de control de calidad.',
  },
  {
    id: 'prod-incubadora-co2',
    sku: 'EQ-INC-005',
    slug: 'incubadora-co2-cultivos',
    name: 'Incubadora CO2 para Cultivos Celulares',
    brand: 'TermoLab',
    family: 'Equipos',
    availability: 'bajo_pedido',
    requiresInstallation: true,
    requiresMaintenance: true,
    image: '/product-images/incubadora-co2-cultivos.jpg',
    categoryId: 'cat-equipos',
    href: '/productos/incubadora-co2-cultivos',
    shortDescription: 'Control preciso de temperatura y CO2 para cultivos celulares in vitro.',
  },
  {
    id: 'prod-tubos-ensayo',
    sku: 'IN-TUB-006',
    slug: 'caja-tubos-ensayo-vidrio',
    name: 'Tubos de Ensayo Vidrio Borosilicato (x500)',
    brand: 'GlassMed',
    family: 'Insumos',
    availability: 'disponible',
    requiresInstallation: false,
    requiresMaintenance: false,
    price: 120,
    currency: 'USD',
    image: '/product-images/caja-tubos-ensayo-vidrio.jpg',
    categoryId: 'cat-insumos',
    href: '/productos/caja-tubos-ensayo-vidrio',
  },
];

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────

function initFirebase() {
  // Opción 1: Variables de entorno
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.log('🔑 Usando credenciales desde variables de entorno...');
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      } as ServiceAccount),
    });
  }

  // Opción 2: serviceAccountKey.json
  const keyPath = resolve(__dirname, '../serviceAccountKey.json');
  try {
    const raw = readFileSync(keyPath, 'utf-8');
    const serviceAccount = JSON.parse(raw) as ServiceAccount;
    console.log('🔑 Usando credenciales desde serviceAccountKey.json...');
    return initializeApp({ credential: cert(serviceAccount) });
  } catch {
    console.error('\n❌ No se encontró serviceAccountKey.json ni variables de entorno.');
    console.error('   Pasos para obtener las credenciales:');
    console.error('   1. Ve a https://console.firebase.google.com');
    console.error('   2. Selecciona tu proyecto → ⚙️ Project Settings → Service Accounts');
    console.error('   3. Haz clic en "Generate new private key"');
    console.error(`   4. Guarda el archivo como: ${keyPath}`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔥 Iniciando migración a Firestore...\n');

  initFirebase();
  const db = getFirestore();

  // ── Migrar Categorías ──────────────────────────────────────────────────────
  console.log(`📁 Migrando ${categories.length} categorías...`);
  const catBatch = db.batch();

  for (const category of categories) {
    const docRef = db.collection('categories').doc(category.id);
    catBatch.set(
      docRef,
      {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.name,
        image: category.image || '',
        href: `/productos?categoryId=${category.id}`,
        createdAt: FieldValue.serverTimestamp(),
        migratedFrom: 'catalog.ts',
      },
      { merge: true }
    );
    console.log(`   ✅ ${category.name} (${category.id})`);
  }

  await catBatch.commit();
  console.log(`\n✅ ${categories.length} categorías migradas.\n`);

  // ── Migrar Productos ───────────────────────────────────────────────────────
  console.log(`📦 Migrando ${products.length} productos...`);

  for (const product of products) {
    const docRef = db.collection('products').doc(product.id);
    const data = {
      id: product.id,
      sku: product.sku || '',
      slug: product.slug,
      name: product.name,
      brand: product.brand || '',
      family: product.family || '',
      shortDescription: (product as Record<string, unknown>).shortDescription || '',
      longDescription: (product as Record<string, unknown>).technicalDescription || '',
      technicalDescription: (product as Record<string, unknown>).technicalDescription || '',
      availability: product.availability,
      requiresInstallation: product.requiresInstallation,
      requiresMaintenance: product.requiresMaintenance,
      price: (product as Record<string, unknown>).price || 0,
      currency: (product as Record<string, unknown>).currency || 'USD',
      image: product.image || '',
      imageUrl: product.image || '',
      images: product.image ? [product.image] : [],
      hoverImage: (product as Record<string, unknown>).hoverImage || '',
      categoryId: product.categoryId,
      href: product.href,
      badge: (product as Record<string, unknown>).badge || null,
      specs: {},
      technicalSpecs: {},
      stock: 0,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      migratedFrom: 'catalog.ts',
    };

    await docRef.set(data, { merge: true });
    console.log(`   ✅ ${product.name} (${product.id})`);
  }

  console.log(`\n✅ ${products.length} productos migrados.`);
  console.log('\n🎉 Migración completada. Verifica en Firebase Console > Firestore Database.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Error durante la migración:', error);
  process.exit(1);
});
