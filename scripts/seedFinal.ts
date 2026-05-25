import { products as realProducts, categories as realCategories } from '../src/data/catalog';
import { createFakeProducts, createFakeCategories } from '../src/data/catalogFake';
import path from 'path';
import fs from 'fs';
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Carga manual de .env para entornos que no lo soportan nativamente
const envPath = path.resolve(process.cwd(), '.env');
console.log('--- Cargando Configuración ---');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  const lines = envConfig.split(/\r?\n/);
  lines.forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim().replace(/^export /i, '');
      let value = parts.slice(1).join('=').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      if (key === 'FIREBASE_PRIVATE_KEY') {
        process.env[key] = value.replace(/\\n/g, '\n');
      } else {
        process.env[key] = value;
      }
    }
  });
}

function getLocalAdminDb() {
  if (getApps().length > 0) return getFirestore(getApps()[0]);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan credenciales de Firebase en .env. Asegúrate de que FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY estén configurados.');
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
  return getFirestore(app);
}

const db = getLocalAdminDb();

async function seedDatabase() { 
  console.log('⏳ Iniciando la creación de colecciones en Firestore (Proton Lab)...');
  
  const allProducts = [...realProducts, ...createFakeProducts()];
  const allCategories = [...realCategories, ...createFakeCategories()];

  try {
    // 1. Usuarios B2B / Admin
    console.log('👥 Creando usuarios (Admin, Clientes, Vendedores)...');
    const users = [
      {
        uid: 'user_admin_001',
        email: 'info@protonlab.pro',
        displayName: 'Proton Admin',
        role: 'ADMIN',
        company: 'Proton Lab HQ',
        isActive: true,
        createdAt: new Date()
      },
      {
        uid: 'user_client_001',
        email: 'compras@hospital-tech.com',
        displayName: 'Gestor Hospitalario',
        role: 'CLIENT',
        companyData: {
            businessName: 'Hospital Tech S.A.',
            industry: 'Salud',
            rut: '76.123.456-K'
        },
        isActive: true,
        createdAt: new Date()
      }
    ];

    for (const user of users) {
      await db.collection('users').doc(user.uid).set(user);
    }

    // 2. Categorías
    console.log('📂 Configurando categorías...');
    for (const cat of allCategories) {
      await db.collection('categories').doc(cat.id).set({
        ...cat,
        isActive: true,
        productCount: allProducts.filter(p => p.categoryId === cat.id).length
      });
    }

    // 3. Productos (Catálogo Real + Fake)
    console.log(`📦 Sincronizando ${allProducts.length} productos...`);
    for (const prod of allProducts) {
      await db.collection('products').doc(prod.id).set({
        ...prod,
        searchKeywords: prod.name.toLowerCase().split(' '),
        stock: Math.floor(Math.random() * 50) + 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 4. Carritos (Ejemplos Desnormalizados)
    console.log('🛒 Generando carritos de prueba...');
    await db.collection('carts').doc('user_client_001').set({
        updatedAt: new Date(),
        items: [
            {
                productId: allProducts[0].id,
                name: allProducts[0].name,
                priceAtAdd: allProducts[0].price || 0,
                quantity: 2
            }
        ]
    });

    // 5. Cotizaciones / Quotes
    console.log('📄 Creando cotizaciones pendientes...');
    await db.collection('quotes').add({
        clientId: 'user_client_001',
        clientName: 'Hospital Tech S.A.',
        status: 'PENDING',
        totalEstimate: (allProducts[0].price || 0) * 2,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: [
            {
                productId: allProducts[0].id,
                name: allProducts[0].name,
                proposedPrice: (allProducts[0].price || 0) * 0.95, // 5% descuento B2B
                quantity: 2
            }
        ],
        createdAt: new Date()
    });

    // 6. Órdenes (Snapshots)
    console.log('🚚 Creando historial de órdenes...');
    await db.collection('orders').add({
        userId: 'user_client_001',
        status: 'COMPLETED',
        total: 5000,
        currency: 'USD',
        items: [
            {
                productId: 'snapshot_prod_1',
                name: 'Equipo Antiguo Red',
                priceAtTime: 2500,
                quantity: 2
            }
        ],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    // 7. Logs y Auditoría
    await db.collection('audit_logs').add({
        action: 'DB_SEED_COMPLETE',
        performedBy: 'system',
        details: `Seed completed with ${allProducts.length} products.`,
        timestamp: new Date()
    });

    console.log('\n🌟 ¡ÉXITO! La base de datos Firebase ha sido sincronizada correctamente.');
    console.log(`📊 Resumen: ${allProducts.length} productos, ${allCategories.length} categorías, 2 usuarios base.`);
  } catch (error) {
    console.error('❌ Error crítico durante el seed:', error);
    process.exit(1);
  }
}

seedDatabase().then(() => process.exit(0));