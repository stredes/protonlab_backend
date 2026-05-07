export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  image: string;
  href: string;
};

export type CatalogProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  family: string;
  subfamily?: string;
  shortDescription?: string;
  technicalDescription?: string;
  datasheetUrl?: string;
  availability: "disponible" | "bajo_pedido" | "sujeto_stock";
  requiresInstallation: boolean;
  requiresMaintenance: boolean;
  price?: number;
  compareAtPrice?: number;
  currency?: "USD";
  image: string;
  hoverImage?: string;
  categoryId: string;
  href: string;
  badge?: {
    text: string;
    className: string;
  };
};

export const categories: CatalogCategory[] = [
  {
    id: "cat-equipos",
    name: "Robótica",
    slug: "equipos",
    image: "/src/assets/images/protonlab/tech_robot_1777091060991.png",
    href: "/shop?category=equipos"
  },
  {
    id: "cat-reactivos",
    name: "Hardware",
    slug: "reactivos",
    image: "/src/assets/images/protonlab/tech_hardware_1777091078472.png",
    href: "/shop?category=reactivos"
  },
  {
    id: "cat-insumos",
    name: "Nanobots",
    slug: "insumos",
    image: "/src/assets/images/protonlab/tech_nanotech_1777091090503.png",
    href: "/shop?category=insumos"
  }
];

export const products: CatalogProduct[] = [
  {
    id: "prod-hardware-ia",
    sku: "HW-IA-001",
    slug: "cluster-ia-nexus",
    name: "Clúster de IA Nexus Server",
    brand: "Nexus",
    family: "Equipos",
    availability: "disponible",
    requiresInstallation: true,
    requiresMaintenance: true,
    price: 45000,
    currency: "USD",
    image: "/src/assets/images/protonlab/ai_hardware_1777123776193.png",
    hoverImage: "/src/assets/images/protonlab/ai_hardware_1777123776193.png",
    categoryId: "cat-equipos",
    href: "/products/cluster-ia-nexus",
    badge: { text: "Destacado", className: "new-badge" },
    shortDescription:
      "Servidor empresarial avanzado para entrenamiento de modelos de inteligencia artificial.",
    technicalDescription:
      "GPUs de última generación, refrigeración líquida y escalabilidad modular."
  },
  {
    id: "prod-procesador-cuantico",
    sku: "HW-QC-002",
    slug: "procesador-cuantico-qcore",
    name: "Procesador Cuántico Q-Core",
    brand: "QuantumTech",
    family: "Componentes",
    availability: "bajo_pedido",
    requiresInstallation: true,
    requiresMaintenance: true,
    price: 150000,
    currency: "USD",
    image: "/src/assets/images/protonlab/quantum_processor_1777123790537.png",
    categoryId: "cat-equipos",
    href: "/products/procesador-cuantico-qcore",
    shortDescription:
      "Procesador cuántico para simulaciones moleculares, optimización avanzada y criptografía."
  },
  {
    id: "prod-ssd-vanguardia",
    sku: "HW-SSD-003",
    slug: "ssd-nvme-neo-force",
    name: "SSD NVMe Neo-Force PCIe 5.0",
    brand: "NeoStorage",
    family: "Componentes",
    availability: "sujeto_stock",
    requiresInstallation: false,
    requiresMaintenance: false,
    price: 850,
    currency: "USD",
    image: "/src/assets/images/protonlab/cutting_edge_ssd_1777123804662.png",
    categoryId: "cat-insumos",
    href: "/products/ssd-nvme-neo-force",
    badge: { text: "Nuevo", className: "offer-badge" }
  },
  {
    id: "prod-microscopio",
    sku: "EQ-MIC-004",
    slug: "microscopio-fluorescencia",
    name: "Microscopio de Fluorescencia HD",
    brand: "OptiSci",
    family: "Equipos",
    availability: "disponible",
    requiresInstallation: true,
    requiresMaintenance: true,
    image: "https://placehold.co/400x500/FFF/0B1F33?text=Microscopio",
    categoryId: "cat-equipos",
    href: "/products/microscopio-fluorescencia",
    shortDescription:
      "Microscopio de alta resolución para análisis de muestras y procesos de control de calidad."
  },
  {
    id: "prod-incubadora-co2",
    sku: "EQ-INC-005",
    slug: "incubadora-co2-cultivos",
    name: "Incubadora CO2 para Cultivos Celulares",
    brand: "TermoLab",
    family: "Equipos",
    availability: "bajo_pedido",
    requiresInstallation: true,
    requiresMaintenance: true,
    image: "https://placehold.co/400x500/FFF/0B1F33?text=Incubadora+CO2",
    categoryId: "cat-equipos",
    href: "/products/incubadora-co2-cultivos",
    shortDescription:
      "Control preciso de temperatura y CO2 para cultivos celulares in vitro."
  },
  {
    id: "prod-tubos-ensayo",
    sku: "IN-TUB-006",
    slug: "caja-tubos-ensayo-vidrio",
    name: "Tubos de Ensayo Vidrio Borosilicato (x500)",
    brand: "GlassMed",
    family: "Insumos",
    availability: "disponible",
    requiresInstallation: false,
    requiresMaintenance: false,
    price: 120,
    currency: "USD",
    image: "https://placehold.co/400x500/FFF/0B1F33?text=Tubos+Ensayo",
    categoryId: "cat-insumos",
    href: "/products/caja-tubos-ensayo-vidrio"
  }
];
