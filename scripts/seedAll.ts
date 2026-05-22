import { adminDb } from '../src/lib/firebaseAdmin';
import { products as realProducts, categories as realCategories } from '../src/data/catalog';
import { createFakeProducts, createFakeCategories } from '../src/data/catalogFake';
import path from 'path';
import fs from 'fs';

// Carga manual de .env para entornos que no lo soportan nativamente
const envPath = path.resolve(process.cwd(), '.env');
console.log('--- Debug de Carga de .env ---');
console.log('Buscando .env en:', envPath);
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  console.log('Archivo .env leído correctamente. Tamaño:', envConfig.length);
  
  // Usamos una regex más robusta para capturar las variables considerando Windows/Linux \r\n
  const lines = envConfig.split(/\r?\n/);
  console.log('Total de líneas detectadas:', lines.length);

  lines.forEach((line, index) => {
    if (!line || line.startsWith('#')) return;
    
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim().replace(/^export /i, '');
      let value = parts.slice(1).join('=').trim();
      
      // Limpiar comillas si existen
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      // Manejar específicamente la private key con sus saltos de línea
      if (key === 'FIREBASE_PRIVATE_KEY') {
        process.env[key] = value.replace(/\\n/g, '\n');
        console.log(`Variable ${key} cargada. Longitud: ${process.env[key]?.length}`);
      } else {
        process.env[key] = value;
        console.log(`Variable ${key} cargada.`);
      }
    }
  });
} else {
  console.error('ERROR: No se encontró el archivo .env en la ruta especificada.');
}
console.log('--- Fin de Debug ---\n');

async function seedDatabase() { 
  console.log('⏳ Iniciando la creación de colecciones en Firestore...');
  
  // LOG DE SEGURIDAD PARA VERIFICAR CARGA FINAL
  console.log('Project ID Final:', process.env.FIREBASE_PROJECT_ID);
  
  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Variables de entorno de Firebase no detectadas. Verifica el archivo .env');
  }

  const allProducts = [...realProducts, ...createFakeProducts()];
  const allCategories = [...realCategories, ...createFakeCategories()];

  try {
    // 1. Crear Usuario Admin y Cliente B2B
    const adminId = 'ADMIN_ID_123';
    await adminDb.collection('users').doc(adminId).set({
      email: 'admin@protonlab.cl',
      displayName: 'Admin Principal',
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date(),
    });

    const clientId = 'CLIENT_B2B_456';
    await adminDb.collection('users').doc(clientId).set({
      email: 'compras@hospitalcentral.cl',
      displayName: 'Hospital Central',
      role: 'CLIENT',
      companyData: {
        rut: '70.123.456-7',
        businessName: 'Hospital Central SpA',
        industry: 'Salud',
        contactPhone: '+56912345678'
      },
      isActive: true,
      createdAt: new Date(),
    });

    const vendorId = 'VENDOR_789';
    await adminDb.collection('users').doc(vendorId).set({
      email: 'ventas1@protonlab.cl',
      displayName: 'Vendedor Estrella',
      role: 'VENDOR',
      isActive: true,
      createdAt: new Date(),
    });
    console.log('✅ Colección "users" creada o actualizada.');

    // 2. Crear Productos desde el catálogo real + fake
    await Promise.all(allProducts.map(async (prod) => {
      await adminDb.collection('products').doc(prod.id).set({
        ...prod,
        searchKeywords: prod.name.toLowerCase().split(' '),
        isActive: true,
        createdAt: new Date(),
      });
    }));
    
    // Y si quieres, agregar también las categorías
    await Promise.all(allCategories.map(async (cat) => {
      await adminDb.collection('categories').doc(cat.id).set({
        ...cat,
        isActive: true,
        createdAt: new Date(),
      });
    }));
    
    console.log(`✅ Colección "products" (${allProducts.length}) y "categories" (${allCategories.length}) creadas.`);

    // 3. Crear Carrito (Usando el id del cliente)
    await adminDb.collection('carts').doc(clientId).set({
      updatedAt: new Date(),
      items: [
        {
          productId: allProducts[0].id,
          name: allProducts[0].name,
          priceAtAdd: allProducts[0].price || 0,
          thumbnail: allProducts[0].image,
          quantity: 2
        },
        {
          productId: allProducts[1].id,
          name: allProducts[1].name,
          priceAtAdd: allProducts[1].price || 0,
          thumbnail: allProducts[1].image,
          quantity: 1
        }
      ]
    });
    console.log('✅ Colección "carts" creada con datos desnormalizados.');

    // 4. Crear Cotización (B2B)
    await adminDb.collection('quotes').add({
      clientId: clientId,
      clientName: 'Hospital Central', // desnormalizado
      vendorId: vendorId,
      status: 'PENDING',
      items: [
        {
          productId: allProducts[0].id,
          name: allProducts[0].name,
          originalPrice: allProducts[0].price || 0,
          proposedPrice: (allProducts[0].price || 0) * 0.9, // 10% de descuento
          quantity: 5
        }
      ],
      totalAmount: (allProducts[0].price || 0) * 0.9 * 5,
      createdAt: new Date(),
    });
    console.log('✅ Colección "quotes" creada.');

    // 5. Crear Orden de Compra (Snapshot inmutable)
    await adminDb.collection('orders').add({
      clientId: clientId,
      clientName: 'Hospital Central', // copiado
      clientEmail: 'compras@hospitalcentral.cl',
      shippingAddress: { calle: 'Av. Salud 1010', comuna: 'Santiago Centro', region: 'RM' },
      status: 'DELIVERED', // snapshot de estado final o actual
      items: [
        {
          productId: allProducts[1].id,
          name: allProducts[1].name, // copiado
          price: allProducts[1].price || 0, // congelado
          quantity: 1
        }
      ],
      totalAmount: allProducts[1].price || 0,
      createdAt: new Date(),
    });
    console.log('✅ Colección "orders" creada con snapshot inmutable.');
    console.log('✅ Colección "orders" creada con snapshot inmutable.');

    // 6. Crear Ticket de Soporte (con Subcolección de messages)
    const ticketRef = await adminDb.collection('support_tickets').add({
      clientId: clientId,
      clientName: 'Hospital Central', // copiado
      subject: 'Falta cable de poder en la centrífuga',
      category: 'Soporte Técnico',
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Subcolección
    await ticketRef.collection('messages').add({
      senderId: clientId,
      senderRole: 'CLIENT',
      text: 'Estimados, al revisar la caja de la centrífuga, no viene el cable 220V.',
      createdAt: new Date(),
    });
    
    await ticketRef.collection('messages').add({
      senderId: vendorId,
      senderRole: 'VENDOR',
      text: 'Hola. Disculpe las molestias, le enviaremos uno por correo express hoy mismo.',
      createdAt: new Date(),
    });
    console.log('✅ Colección "support_tickets" y subcolección "messages" creadas.');

    // 7. Crear Mensaje de Contacto web
    await adminDb.collection('contact_messages').add({
      name: 'Juan Pérez',
      email: 'juan@empresa.cl',
      subject: 'Duda sobre envíos',
      message: '¿Hacen envíos a regiones?',
      isRead: false,
      createdAt: new Date(),
    });
    console.log('✅ Colección "contact_messages" creada.');

    // 8. Crear Log de Auditoría
    await adminDb.collection('audit_logs').add({
      action: 'SYSTEM_INIT',
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      targetId: 'ALL',
      details: 'Base de datos inicializada con datos de prueba.',
      createdAt: new Date(),
    });
    console.log('✅ Colección "audit_logs" creada.');

    console.log('🎉 ¡Base de datos poblada exitosamente! Ve a tu consola de Firebase para ver las colecciones.');

  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
  }
}

seedDatabase();