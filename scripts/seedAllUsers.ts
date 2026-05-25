#!/usr/bin/env node
/**
 * seedAllUsers.ts
 *
 * Crea usuarios de prueba para todos los roles faltantes en Firebase Auth y Firestore.
 *
 * USO:
 *   npx tsx scripts/seedAllUsers.ts
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

const USERS_TO_SEED = [
  {
    email: 'vendedor@protonlab.com',
    password: 'Password123!',
    name: 'Usuario Vendedor',
    role: 'vendedor',
  },
  {
    email: 'bodega@protonlab.com',
    password: 'Password123!',
    name: 'Usuario Bodega',
    role: 'bodega',
  },
  {
    email: 'socio@protonlab.com',
    password: 'Password123!',
    name: 'Usuario Socio',
    role: 'socio',
    company: 'Cliente Demo',
  }
];

async function seedUsers() {
  for (const user of USERS_TO_SEED) {
    let uid: string;
    try {
      // 1. Crear en Firebase Auth
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.name,
      });
      uid = userRecord.uid;
      console.log(`✅ Usuario creado en Auth: ${user.email}`);
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        const userRecord = await auth.getUserByEmail(user.email);
        uid = userRecord.uid;
        await auth.updateUser(uid, { password: user.password });
        console.log(`✅ Usuario ya existía en Auth: ${user.email} (Password actualizado)`);
      } else {
        console.error(`❌ Error creando ${user.email}:`, e);
        continue;
      }
    }

    // 2. Setear custom claims
    const claims = { 
      role: user.role, 
      ...(user.company ? { company: user.company } : {}),
      isActive: true 
    };
    await auth.setCustomUserClaims(uid, claims);

    // 3. Crear en Firestore
    await db.collection('users').doc(uid).set({
      uid,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company || null,
      isActive: true,
      createdAt: new Date(),
    }, { merge: true });
    console.log(`✅ Sincronizado en Firestore: ${user.email}\n`);
  }

  console.log('🎉 ¡Todos los usuarios fueron creados correctamente!');
}

seedUsers();
