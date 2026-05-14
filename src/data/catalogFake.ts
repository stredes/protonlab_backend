import type { CatalogCategory, CatalogProduct } from "./catalog";

export function createFakeCategories(): CatalogCategory[] {
  return [
    {
      id: "fake-cat-robotica",
      name: "Robótica Autónoma",
      slug: "robotica-autonoma",
      image: "https://placehold.co/640x420/0B1F33/FFFFFF?text=Robotica+Autonoma",
      href: "/productos?categoryId=fake-cat-robotica"
    },
    {
      id: "fake-cat-ia",
      name: "Infraestructura IA",
      slug: "infraestructura-ia",
      image: "https://placehold.co/640x420/102A43/FFFFFF?text=Infraestructura+IA",
      href: "/productos?categoryId=fake-cat-ia"
    },
    {
      id: "fake-cat-sensores",
      name: "Sensórica Crítica",
      slug: "sensorica-critica",
      image: "https://placehold.co/640x420/1F2937/FFFFFF?text=Sensorica+Critica",
      href: "/productos?categoryId=fake-cat-sensores"
    }
  ];
}

export function createFakeProducts(): CatalogProduct[] {
  return [
    {
      id: "fake-robot-arm-r7",
      sku: "FAKE-RBT-001",
      slug: "brazo-robotico-r7",
      name: "Brazo Robótico R7 de Precisión",
      brand: "Apex Motion",
      family: "Robótica",
      subfamily: "Manipulación",
      shortDescription:
        "Brazo robótico industrial para líneas de ensamblaje de alta precisión y laboratorios automatizados.",
      technicalDescription:
        "7 ejes, visión integrada, tolerancia micrométrica y operación 24/7 para celdas críticas.",
      availability: "disponible",
      requiresInstallation: true,
      requiresMaintenance: true,
      price: 78000,
      compareAtPrice: 86000,
      currency: "USD",
      image: "https://placehold.co/640x420/0B1F33/FFFFFF?text=Brazo+R7",
      hoverImage: "https://placehold.co/640x420/12385C/FFFFFF?text=Brazo+R7+Hover",
      categoryId: "fake-cat-robotica",
      href: "/products/brazo-robotico-r7",
      badge: {
        text: "Demo Fake",
        className: "new-badge"
      }
    },
    {
      id: "fake-ai-cluster-x12",
      sku: "FAKE-AI-002",
      slug: "cluster-ia-x12",
      name: "Cluster IA X12 Tensor Rack",
      brand: "Helix Compute",
      family: "Infraestructura IA",
      subfamily: "GPU Clusters",
      shortDescription:
        "Rack de inferencia y entrenamiento para modelos fundacionales y cargas de visión computacional.",
      technicalDescription:
        "12 GPUs, refrigeración líquida, networking de baja latencia y escalado horizontal.",
      availability: "bajo_pedido",
      requiresInstallation: true,
      requiresMaintenance: true,
      price: 215000,
      currency: "USD",
      image: "https://placehold.co/640x420/102A43/FFFFFF?text=Cluster+IA+X12",
      categoryId: "fake-cat-ia",
      href: "/products/cluster-ia-x12",
      badge: {
        text: "Pilot",
        className: "offer-badge"
      }
    },
    {
      id: "fake-lidar-s9",
      sku: "FAKE-SNS-003",
      slug: "lidar-s9-multicapa",
      name: "LiDAR S9 Multicapa",
      brand: "VectorSense",
      family: "Sensores",
      subfamily: "Percepción",
      shortDescription:
        "Sensor LiDAR para navegación autónoma, cartografía de precisión y vigilancia perimetral.",
      technicalDescription:
        "Rango extendido, alta densidad de puntos y operación estable en entornos hostiles.",
      availability: "disponible",
      requiresInstallation: false,
      requiresMaintenance: false,
      price: 9200,
      currency: "USD",
      image: "https://placehold.co/640x420/1F2937/FFFFFF?text=LiDAR+S9",
      categoryId: "fake-cat-sensores",
      href: "/products/lidar-s9-multicapa"
    },
    {
      id: "fake-edge-box-k4",
      sku: "FAKE-EDG-004",
      slug: "edge-box-k4",
      name: "Edge Box K4 Rugged AI",
      brand: "NorthGrid",
      family: "Infraestructura IA",
      subfamily: "Edge Computing",
      shortDescription:
        "Nodo edge ruggedizado para inferencia en planta, faena, seguridad y operación remota.",
      technicalDescription:
        "Baja latencia, montaje industrial, protección térmica y telemetría integrada.",
      availability: "sujeto_stock",
      requiresInstallation: true,
      requiresMaintenance: false,
      price: 12400,
      currency: "USD",
      image: "https://placehold.co/640x420/16324F/FFFFFF?text=Edge+Box+K4",
      categoryId: "fake-cat-ia",
      href: "/products/edge-box-k4"
    },
    {
      id: "fake-drone-inspect-z2",
      sku: "FAKE-DRN-005",
      slug: "drone-inspect-z2",
      name: "Drone Inspect Z2",
      brand: "SkyForge",
      family: "Robótica",
      subfamily: "Inspección",
      shortDescription:
        "Drone de inspección técnica para infraestructura crítica, bodegas y activos remotos.",
      technicalDescription:
        "Cámara térmica, navegación asistida por IA y autonomía extendida para patrullaje industrial.",
      availability: "bajo_pedido",
      requiresInstallation: false,
      requiresMaintenance: true,
      price: 18900,
      currency: "USD",
      image: "https://placehold.co/640x420/1D3557/FFFFFF?text=Drone+Inspect+Z2",
      categoryId: "fake-cat-robotica",
      href: "/products/drone-inspect-z2"
    },
    {
      id: "fake-sensor-array-q8",
      sku: "FAKE-SNS-006",
      slug: "sensor-array-q8",
      name: "Sensor Array Q8",
      brand: "QuantX",
      family: "Sensores",
      subfamily: "Monitoreo",
      shortDescription:
        "Matriz sensórica para monitoreo distribuido en entornos industriales y laboratorios avanzados.",
      technicalDescription:
        "Captura multi-variable, alertas tempranas y streaming de datos para operación crítica.",
      availability: "disponible",
      requiresInstallation: true,
      requiresMaintenance: false,
      price: 6400,
      currency: "USD",
      image: "https://placehold.co/640x420/243B53/FFFFFF?text=Sensor+Array+Q8",
      categoryId: "fake-cat-sensores",
      href: "/products/sensor-array-q8"
    }
  ];
}
