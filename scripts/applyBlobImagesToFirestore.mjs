import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const backendRoot = process.cwd();
const manifestPath = path.resolve(backendRoot, "tmp/firestore-product-blob-images.json");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = key === "FIREBASE_PRIVATE_KEY" ? value.replace(/\\n/g, "\n") : value;
  }
}

loadEnvFile(path.resolve(backendRoot, ".env.production.local"));
loadEnvFile(path.resolve(backendRoot, ".env.local"));
loadEnvFile(path.resolve(backendRoot, ".env"));

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error("Faltan credenciales Firebase Admin.");
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY
    })
  });
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const db = getFirestore();
const batchSize = 400;

for (let index = 0; index < manifest.length; index += batchSize) {
  const batch = db.batch();
  const chunk = manifest.slice(index, index + batchSize);

  for (const item of chunk) {
    const ref = db.collection("products").doc(item.productId);
    batch.set(
      ref,
      {
        image: item.blobUrl,
        imageUrl: item.blobUrl,
        images: [item.blobUrl],
        blobImagePath: item.pathname,
        imageSource: item.source,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`Actualizados ${Math.min(index + chunk.length, manifest.length)}/${manifest.length}`);
}

console.log("Firestore actualizado con URLs de Blob.");
