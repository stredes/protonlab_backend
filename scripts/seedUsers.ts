#!/usr/bin/env node
/**
 * seedUsers.ts
 *
 * Crea un usuario 'root' inicial en Firebase Auth y Firestore
 * para poder acceder a los paneles de administración.
 *
 * USO:
 *   npx tsx scripts/seedUsers.ts
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────
const keyPath = resolve(__dirname, '../serviceAccountKey.json');
try {
  const raw = readFileSync(keyPath, 'utf-8');
  const serviceAccount = JSON.parse(raw) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
  console.log('🔑 Firebase Admin inicializado.');
} catch {
  console.error('❌ No se encontró serviceAccountKey.json en protonlab_backend/');
  process.exit(1);
}

const auth = getAuth();
const db = getFirestore();

async function seedRootUser() {
  const email = 'root@protonlab.com';
  const password = 'Password123!';
  let uid: string;

  try {
    // 1. Crear en Firebase Auth
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: 'Root Administrator',
        emailVerified: true,
      });
      uid = userRecord.uid;
      console.log(`✅ Usuario creado en Auth con UID: ${uid}`);
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        const userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
        await auth.updateUser(uid, { password }); // Asegurar que la contraseña sea correcta
        console.log(`✅ Usuario ya existía en Auth. Contraseña actualizada. UID: ${uid}`);
      } else {
        throw e;
      }
    }

    // 2. Establecer Custom Claims (Rol: root)
    await auth.setCustomUserClaims(uid, { role: 'root' });
    console.log(`✅ Custom claims establecidos: { role: 'root' }`);

    // 3. Crear en Firestore (colección 'users')
    await db.collection('users').doc(uid).set({
      uid,
      email,
      name: 'Root Administrator',
      role: 'root',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`✅ Documento de usuario creado en Firestore.`);

    console.log('\n🎉 ¡Listo! Ahora puedes iniciar sesión con:');
    console.log(`✉️  Email:    ${email}`);
    console.log(`🔑 Password: ${password}`);

  } catch (error) {
    console.error('❌ Error creando usuario root:', error);
  }
}

seedRootUser();
