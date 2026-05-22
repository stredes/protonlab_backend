import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";

const images = [
  {
    productId: "prod-hardware-ia",
    variant: "primary",
    path: "public/product-images/cluster-ia-nexus.jpg"
  },
  {
    productId: "prod-procesador-cuantico",
    variant: "primary",
    path: "public/product-images/procesador-cuantico-qcore.jpg"
  },
  {
    productId: "prod-ssd-vanguardia",
    variant: "primary",
    path: "public/product-images/ssd-nvme-neo-force.jpg"
  },
  {
    productId: "prod-microscopio",
    variant: "primary",
    path: "public/product-images/microscopio-fluorescencia.jpg"
  },
  {
    productId: "prod-incubadora-co2",
    variant: "primary",
    path: "public/product-images/incubadora-co2-cultivos.jpg"
  },
  {
    productId: "prod-tubos-ensayo",
    variant: "primary",
    path: "public/product-images/caja-tubos-ensayo-vidrio.jpg"
  }
];

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("Falta BLOB_READ_WRITE_TOKEN para subir imágenes al Blob Store.");
}

for (const image of images) {
  const fileName = image.path.split("/").at(-1);
  const pathname = `products/${image.productId}/${image.variant}-${Date.now()}-${fileName}`;
  const body = await readFile(image.path);
  const blob = await put(pathname, body, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true
  });

  console.log(`${image.productId} ${image.variant}: ${blob.url}`);
}
