import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const backendRoot = process.cwd();
const frontendRoot = path.resolve(backendRoot, "../front-protonlab");
const outputDir = path.resolve(backendRoot, "tmp");
const outputPath = path.resolve(outputDir, "firestore-product-blob-images.json");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(path.resolve(backendRoot, ".env.local"));
loadEnvFile(path.resolve(backendRoot, ".env"));

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!blobToken) {
  throw new Error("Falta BLOB_READ_WRITE_TOKEN. Ejecuta `vercel env pull .env.local --yes` o exporta el token.");
}

const firebaseProjectId = process.env.FIRESTORE_PROJECT_ID || "protonlab-ded30";
const firebaseApiKey =
  process.env.FIRESTORE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyADLsPP-iypfLyvc5DBeu_ZaKe5shnHfoE";

function fieldValue(field) {
  if (!field) return "";
  return (
    field.stringValue ??
    field.integerValue ??
    field.doubleValue ??
    field.booleanValue ??
    ""
  );
}

async function fetchProducts() {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/products`;
  const products = [];
  let pageToken = "";

  do {
    const url = new URL(baseUrl);
    url.searchParams.set("key", firebaseApiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Firestore ${response.status}: ${JSON.stringify(payload)}`);
    }

    for (const doc of payload.documents ?? []) {
      const fields = doc.fields ?? {};
      products.push({
        id: doc.name.split("/").at(-1),
        name: String(fieldValue(fields.name)),
        sku: String(fieldValue(fields.sku)),
        slug: String(fieldValue(fields.slug)),
        brand: String(fieldValue(fields.brand)),
        family: String(fieldValue(fields.family) || fieldValue(fields.familia)),
        categoryId: String(fieldValue(fields.categoryId)),
        currentImage: String(fieldValue(fields.image) || fieldValue(fields.imageUrl))
      });
    }

    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return products.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

const imageAliases = [
  {
    test: /hematolog|hemo|trinivel/i,
    path: "src/assets/images/amilab/hematologia.png",
    source: "asset hematologia"
  },
  {
    test: /quimica|glucosa|creatinina|reactivo/i,
    path: "src/assets/images/amilab/microbiologia.png",
    source: "asset reactivos/microbiologia"
  },
  {
    test: /electrol/i,
    path: "src/assets/images/amilab/electrolitos.png",
    source: "asset electrolitos"
  },
  {
    test: /orina|uro/i,
    path: "src/assets/images/amilab/orinas.png",
    source: "asset orinas"
  },
  {
    test: /cabina|microbio/i,
    path: "src/assets/images/amilab/microbiologia.png",
    source: "asset microbiologia"
  },
  {
    test: /tbc|tuberculosis/i,
    path: "src/assets/images/amilab/tbc.png",
    source: "asset tbc"
  },
  {
    test: /tubo|edta|ensayo/i,
    path: "../protonlab_backend/public/product-images/caja-tubos-ensayo-vidrio.jpg",
    source: "asset tubos ensayo"
  },
  {
    test: /punta|pipeta/i,
    path: "src/assets/images/amilab/support-pipette-test-tubes.jpg",
    source: "asset pipeta"
  },
  {
    test: /centrif/i,
    path: "src/assets/images/amilab/support-centrifuge-main.jpg",
    source: "asset centrifuga"
  },
  {
    test: /incubadora|cultivo|co2/i,
    path: "../protonlab_backend/public/product-images/incubadora-co2-cultivos.jpg",
    source: "asset incubadora co2"
  },
  {
    test: /microscop/i,
    path: "../protonlab_backend/public/product-images/microscopio-fluorescencia.jpg",
    source: "asset microscopio"
  },
  {
    test: /cluster|server|ia|tensor|nexus/i,
    path: "src/assets/images/protonlab/ai_hardware_1777123776193.png",
    source: "asset hardware ia"
  },
  {
    test: /edge|hardware|ssd|cepillo|grabado/i,
    path: "src/assets/images/protonlab/tech_hardware_1777091078472.png",
    source: "asset hardware"
  },
  {
    test: /robot|brazo|drone/i,
    path: "src/assets/images/protonlab/tech_robot_1777091060991.png",
    source: "asset robotica"
  },
  {
    test: /nanobot|nano/i,
    path: "src/assets/images/protonlab/tech_nanotech_1777091090503.png",
    source: "asset nanotecnologia"
  },
  {
    test: /lidar|sensor/i,
    path: "src/assets/images/protonlab/nano_banana_hardware_1777090630644.png",
    source: "asset sensores"
  },
  {
    test: /procesador|cuant/i,
    path: "../protonlab_backend/public/product-images/procesador-cuantico-qcore.jpg",
    source: "asset procesador cuantico"
  },
  {
    test: /florero|florer/i,
    path: "src/assets/images/protonlab/nano_banana_lab_1777090301386.png",
    source: "asset laboratorio generico"
  }
];

function resolveImage(product) {
  const haystack = [
    product.name,
    product.slug,
    product.sku,
    product.brand,
    product.family,
    product.categoryId
  ].join(" ");
  const match = imageAliases.find((entry) => entry.test.test(haystack));
  const selected = match ?? {
    path: "src/assets/images/protonlab/hero-equipment.png",
    source: "asset equipo generico"
  };
  const absolutePath = path.resolve(frontendRoot, selected.path);
  return {
    ...selected,
    absolutePath
  };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function safeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const products = await fetchProducts();
const results = [];

for (const product of products) {
  const image = resolveImage(product);
  if (!existsSync(image.absolutePath)) {
    throw new Error(`No existe la imagen para ${product.id}: ${image.absolutePath}`);
  }

  const body = readFileSync(image.absolutePath);
  const ext = path.extname(image.absolutePath).toLowerCase() || ".png";
  const pathname = `products/${product.id}/primary-${Date.now()}-${safeName(product.name || product.id)}${ext}`;
  const blob = await put(pathname, body, {
    access: "public",
    contentType: contentTypeFor(image.absolutePath),
    addRandomSuffix: true,
    token: blobToken
  });

  const record = {
    productId: product.id,
    name: product.name,
    sku: product.sku,
    source: image.source,
    localImage: image.absolutePath,
    blobUrl: blob.url,
    pathname: blob.pathname
  };
  results.push(record);
  console.log(`${results.length}/${products.length} ${product.id} -> ${blob.url}`);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`Manifest: ${outputPath}`);
