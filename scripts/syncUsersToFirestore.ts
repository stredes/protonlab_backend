#!/usr/bin/env node
/**
 * syncUsersToFirestore.ts
 *
 * Busca todos los usuarios que existen en Firebase Auth y, si no están en Firestore,
 * los crea en la colección 'users'.
 *
 * USO:
 *   npx tsx scripts/syncUsersToFirestore.ts
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const keyPath = resolve(__dirname, '../serviceAccountKey.json');
try {
  const raw = readFileSync(keyPath, 'utf-8');
  const serviceAccount = JSON.parse(raw) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
  console.log('🔑 Firebase Admin inicializado.');
} catch {
  console.error('❌ No se encontró serviceAccountKey.json');
  process.exit(1);
}

const auth = getAuth();
const db = getFirestore();

async function syncUsers() {
  try {
    let pageToken: string | undefined;
    let count = 0;

    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;

      for (const user of page.users) {
        const docRef = db.collection('users').doc(user.uid);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          console.log(`Sincronizando a Firestore: ${user.email} (${user.uid})`);
          
          const claims = user.customClaims || {};
          await docRef.set({
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'Usuario',
            role: claims.role || 'socio',
            company: claims.company || null,
            vendorId: claims.vendorId || null,
            department: claims.department || null,
            phone: claims.phone || null,
            isActive: !user.disabled && claims.isActive !== false,
            createdAt: new Date(),
          }, { merge: true });
          count++;
        }
      }
    } while (pageToken);

    console.log(`\n✅ Sincronización completada. Se añadieron ${count} usuarios a Firestore.`);
  } catch (error) {
    console.error('❌ Error al sincronizar:', error);
  }
}

syncUsers();
