# Lineamientos Técnicos para el Encargado de Backend - Proyecto Proton Lab

## Introducción

Este documento establece los lineamientos técnicos para el encargado de backend del proyecto Proton Lab. El objetivo es guiar la implementación, el respeto de las convenciones y la conexión de los componentes necesarios para el correcto funcionamiento de la plataforma. El backend actual, proveniente de la plataforma anterior, servirá como base conceptual para un Backend Protonlab B2B + ERP Interno, una plataforma cloud destinada a gestionar cotizaciones, pedidos, clientes, productos, inventario, bodega, despacho, usuarios, roles, notificaciones y dashboards.

## 1. Arquitectura General

El backend debe operar como una API REST serverless utilizando la siguiente pila tecnológica:

- Vercel Functions: Para la exposición de endpoints.
- Firebase Auth: Para la autenticación de usuarios.
- Firestore: Como base de datos principal.
- TypeScript + Node.js 20+: Lenguaje y entorno de ejecución.
- Zod: Para la validación de datos de entrada.
- Logs estructurados: Para auditoría y trazabilidad.
Archivos base relevantes:

- api/index.ts: Router principal.
- src/middleware/auth.ts: Lógica de autenticación y roles.
- src/utils/responses.ts: Formato estándar de respuesta.
- src/lib/firestore.ts: Acceso a Firestore.
- src/models: Definición de modelos de datos.
- src/validation: Esquemas de validación con Zod.
## 2. Regla Central del Backend

El backend debe funcionar como el ERP interno de Protonlab, no limitarse a ser una tienda B2B. Debe cubrir los siguientes procesos clave:

1. Cliente B2B: Revisa el catálogo de productos.
2. Cliente: Solicita una cotización.
3. Vendedor: Revisa la cotización.
4. Administrador: Aprueba o rechaza la cotización.
5. Cotización Aprobada: Se convierte en un pedido.
6. Pedido: Pasa a la gestión de bodega.
7. Bodega: Prepara los productos.
8. Administrador: Aprueba el despacho.
9. Bodega: Realiza el despacho.
10. Sistema: Registra movimientos de inventario, genera notificaciones y mantiene un registro de auditoría.
## 3. Formato Estándar de Respuestas

Todos los endpoints deben adherirse a un formato de respuesta estándar. Esto asegura consistencia y facilita la integración con el frontend.

Respuesta correcta:

{
  "success": true,
  "data": {}
}

Respuesta con error:

{
  "success": false,
  "error": "Mensaje del error",
  "code": "VALIDATION_ERROR",
  "details": {
    "requestId": "uuid"
  }
}

Lineamientos:

- Utilizar siempre ok(res, data) para respuestas exitosas.
- Utilizar siempre fail(res, message, statusCode) para manejar errores.
- Evitar devolver respuestas manuales con estructuras diferentes.
- Toda respuesta debe incluir un x-request-id para trazabilidad.
## 4. Roles del Sistema Protonlab

El backend ya contempla una serie de roles que deben ser utilizados y gestionados adecuadamente para Protonlab. Los roles y su uso recomendado son:

| Rol | Uso en Protonlab |
| --- | --- |
| root | Superadministrador técnico. Acceso total y capacidad de crear usuarios. |
| admin | Administración general, aprobaciones, reportes, gestión de usuarios y operaciones. |
| vendedor | Gestión de clientes, cotizaciones y pedidos comerciales. |
| bodega | Preparación de pedidos, control de stock y gestión de despachos. |
| callcenter | Apoyo comercial, contacto con clientes y gestión de cotizaciones. |
| soporte | Revisión limitada de clientes, pedidos y productos para asistencia. |
| socio | Cliente preferente o cuenta especial B2B. |
| cliente | Cliente B2B estándar. |

Los permisos principales ya están definidos en src/models/user.ts.

Regla importante: Los permisos críticos deben validarse siempre en el backend. Nunca confiar únicamente en la validación del frontend. Utilizar las funciones de middleware existentes como requireAuth, requireRole, requireAdmin, requireWarehouse, requirePermission.

## 5. Autenticación

Todo endpoint privado debe requerir un token de Firebase para autenticación, enviado en el encabezado Authorization:

Authorization: Bearer <firebase_id_token>

Errores esperados de autenticación:

| Caso | Código HTTP | Código de Error |
| --- | --- | --- |
| Sin token | 401 | TOKEN_MISSING |
| Token inválido | 401 | TOKEN_INVALID |
| Token expirado | 401 | TOKEN_EXPIRED |
| Sin permiso | 403 | FORBIDDEN |

Endpoints públicos recomendados (no requieren autenticación):

- GET /api/health
- GET /api/ready
- GET /api/products
- GET /api/products/:id
- GET /api/categories
- GET /api/metadata
- POST /api/contact-messages
- POST /api/support-requests
- POST /api/quotes (si se permite solicitar cotización sin login).
## 6. Colecciones Firestore Recomendadas

El backend debe interactuar con las siguientes colecciones en Firestore. Se listan las existentes y las recomendadas para Protonlab:

- users (gestionado por Firebase Auth)
- userProfiles
- customers
- products
- categories
- quotes
- orders
- orderPreparations
- inventory_movements
- notifications
- supportRequests
- contactMessages
- auditLogs
- metadata
Colecciones adicionales recomendadas para Protonlab:

- billing_documents
- payments
- shipments
- stock
- warehouse_locations
## 7. Clientes B2B

El modelo base para clientes se encuentra en src/models/customer.ts. Los campos clave y lineamientos son:

Campos clave:

- email
- name
- phone
- company
- rut
- address
- assignedSalesRep
- assignedSalesRepName
- creditLimit
- paymentTerms
- discount
- status
- notes
- createdAt
- updatedAt
Lineamientos:

- Cada cliente debe tener un vendedor asignado (assignedSalesRep, assignedSalesRepName).
- El campo rut debe ser utilizado para la identificación en Chile.
- paymentTerms debe controlar las condiciones comerciales (ej. contado, 30dias, 60dias, 90dias).
- status debe controlar la operatividad del cliente (ej. activo, inactivo, suspendido).
Endpoints necesarios:

- GET /api/admin/clients
- GET /api/vendor/clients
- POST /api/customers (formalizar CRUD completo)
- GET /api/customers/:id
- PUT /api/customers/:id
Se recomienda crear un CRUD explícito en /api/customers además de las vistas existentes para admin y vendor.

## 8. Productos y Catálogo

El modelo base para productos se encuentra en src/models/product.ts. Los campos y lineamientos son:

Campos:

- id
- name
- slug
- categoryId
- categoryName
- brand
- shortDescription
- longDescription
- specs
- searchKeywords
- requiresInstallation
- isActive
- imageUrls
- price
- createdAt
- updatedAt
Endpoints actuales:

- GET /api/products
- GET /api/products/:id
- GET /api/products/slug/:slug
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id
Lineamientos:

- GET /api/products debe alimentar el catálogo público B2B.
- POST, PUT, DELETE deben ser restringidos a roles admin o root.
- DELETE debe ser un soft delete, marcando isActive: false.
- El catálogo debe filtrar productos inactivos.
- Mantener searchKeywords para una búsqueda eficiente.
Campos adicionales recomendados para Protonlab:

- sku
- stock
- unit
- warehouseLocation
- cost
- margin
- provider
- criticalStock
## 9. Categorías

Endpoints actuales:

- GET /api/categories
- GET /api/categories/:id
- POST /api/categories
- PUT /api/categories/:id
- DELETE /api/categories/:id
Lineamientos:

- Utilizar para organizar el catálogo comercial.
- No borrar físicamente categorías con productos asociados; mantener isActive.
- Relacionar cada producto por categoryId.
## 10. Cotizaciones

El modelo base para cotizaciones se encuentra en src/models/quote.ts. Los estados y el flujo recomendado son:

Estados actuales:

- pendiente
- en_revision_vendedor
- aprobado_vendedor
- rechazado_vendedor
- en_revision_admin
- aprobado
- rechazado
- convertida
- vencida
Flujo recomendado Protonlab:

pendiente → en_revision_vendedor → aprobado_vendedor → en_revision_admin → aprobado → convertida

Flujo de rechazo:

pendiente → rechazado_vendedor

o

aprobado_vendedor → rechazado

Endpoints actuales:

- POST /api/quotes
- GET /api/quotes
- GET /api/quotes/:id
- PUT /api/quotes/:id
- POST /api/quotes/:id/vendor-approve
- POST /api/quotes/:id/admin-approve
- POST /api/quotes/:id/convert-to-order
- GET /api/quotes/vendor/pending
- GET /api/vendor/quotes/pending
- POST /api/vendor/quotes/:id/approve
- POST /api/vendor/quotes/:id/reject
Lineamientos:

- POST /api/quotes crea la solicitud inicial de cotización.
- Si el cliente existe, debe asignarse al vendedor correspondiente.
- El vendedor puede completar precios, descuentos, notas y aprobar.
- El administrador debe aprobar antes de convertir a pedido.
- Una cotización solo puede convertirse si está en estado aprobado.
- Al convertirse, debe marcarse como convertida y guardar el orderId.
- Deben generarse notificaciones al vendedor, administrador, cliente y bodega según el estado.
Datos mínimos para crear cotización:

{
  "customerName": "Cliente B2B",
  "customerEmail": "cliente@empresa.cl",
  "customerPhone": "+56912345678",
  "organization": "Empresa Cliente",
  "taxId": "76123456-7",
  "items": [
    {
      "productId": "abc123",
      "productName": "Producto Protonlab",
      "quantity": 2
    }
  ],
  "customerMessage": "Necesito cotizar estos productos"
}

## 11. Pedidos

El modelo base para pedidos se encuentra en src/models/order.ts. Los estados y el flujo recomendado son:

Estados de pedido:

- pendiente
- confirmado
- procesando
- enviado
- entregado
- cancelado
Estados de pago:

- pendiente
- parcial
- pagado
- reembolsado
Métodos de pago:

- transferencia
- efectivo
- cheque
- tarjeta
- credito_30
- credito_60
- credito_90
Endpoints actuales:

- GET /api/orders
- POST /api/orders
- GET /api/orders/:id
- PUT /api/orders/:id
Lineamientos:

- El pedido debe nacer desde una cotización aprobada para el flujo B2B formal.
- POST /api/orders directo debe restringirse a admin/vendedor.
- Todo pedido debe tener: cliente, items, totales, estado, estado de pago, dirección de despacho, trazabilidad de creación/actualización.
- Al crear un pedido desde una cotización, debe crearse una preparación en bodega.
- Al convertir una cotización a pedido, debe registrarse un movimiento de inventario tipo reserva.
Flujo recomendado:

pendiente → confirmado → procesando → enviado → entregado

Flujo de cancelación:

pendiente/procesando → cancelado

## 12. Bodega y Preparación

El modelo base para la preparación de pedidos se encuentra en src/models/orderPreparation.ts. Los estados y lineamientos son:

Estados de preparación:

- pendiente
- asignado
- en_preparacion
- preparado
- despachado
Estados de inspección:

- pending
- approved
- rejected
Estados de aprobación administrativa:

- pending
- approved
- rejected
Endpoints actuales:

- GET /api/warehouse/orders
- GET /api/warehouse/stats
- GET /api/warehouse/prepare/:orderId
- POST /api/warehouse/prepare/:orderId
- PATCH /api/warehouse/prepare/:orderId
- POST /api/warehouse/approve-dispatch/:orderId
- POST /api/warehouse/dispatch/:orderId
- POST /api/warehouse/reassign/:orderId
- GET /api/warehouse/stock
- GET /api/warehouse/stock/export
Lineamientos:

- Solo roles bodega, admin o root pueden operar la bodega.
- La preparación debe validar cantidades: no negativas, no superiores a lo solicitado, no marcar ítem preparado si no tiene cantidad completa.
- Para despachar se requiere: status: preparado, inspectionStatus: approved, adminApprovalStatus: approved.
- Al despachar:
  - order.status pasa a enviado.
  - Se registra trackingNumber y carrier.
  - Se crea un movimiento de inventario tipo salida/despacho.
Flujo de bodega:

Pedido confirmado → preparación asignada → en preparación → preparado → inspección aprobada → aprobación admin → despachado → orden enviada

## 13. Inventario

Endpoints y utilidades actuales:

- POST /api/inventory/upload
- GET /api/warehouse/stock
- GET /api/warehouse/stock/export
- src/utils/inventoryMovements.ts
Lineamientos Protonlab:

- Cada movimiento de stock debe quedar registrado.
- No descontar inventario sin registrar movimiento.
- Separar conceptos: stock disponible, stock reservado, stock despachado, stock crítico.
Movimientos recomendados:

- purchase_in
- manual_adjustment
- sale_reserved
- sale_dispatch
- sale_cancelled
- return_in
Reglas:

- Al convertir cotización a pedido: reservar stock.
- Al despachar: descontar stock real.
- Al cancelar pedido: liberar reserva.
- No permitir despacho si el stock no fue validado.
- Mantener trazabilidad por orderId, quoteId, productId, performedBy.
## 14. Notificaciones

El modelo base para notificaciones se encuentra en src/models/notification.ts. Los tipos y lineamientos son:

Tipos actuales:

- quote_new
- quote_vendor_approved
- quote_vendor_rejected
- quote_admin_approved
- quote_admin_rejected
- quote_converted
- order_new
- order_confirmed
- order_preparing
- order_ready
- order_dispatched
- order_delivered
- order_cancelled
Endpoint actual:

- GET /api/notifications
Lineamientos:

- Crear notificaciones cuando:
  - Se crea una nueva cotización.
  - Una cotización cambia de estado (aprobada/rechazada por vendedor o admin, convertida).
  - Se crea un nuevo pedido.
  - Un pedido cambia de estado (confirmado, en preparación, listo, despachado, entregado, cancelado).
- Las notificaciones deben ser específicas para cada rol (cliente, vendedor, admin, bodega).
- Considerar notificaciones por email o push para eventos críticos.
## 15. Auditoría y Logs

Modelo base: src/models/auditLog.ts

Lineamientos:

- Registrar todas las acciones críticas realizadas por los usuarios (creación/edición/eliminación de productos, clientes, cotizaciones, pedidos, movimientos de inventario).
- Cada log debe incluir: userId, action, entityType, entityId, timestamp, details (cambios específicos).
- Los logs deben ser inmutables.
- Facilitar la consulta de logs para auditorías de seguridad y operacionales.
## 16. Seguridad

Lineamientos clave:

- Validación de entrada: Usar Zod para validar todos los datos de entrada en el backend. Nunca confiar en la validación del frontend.
- Control de acceso: Implementar requireRole y requirePermission en todos los endpoints protegidos.
- Protección de datos sensibles: Encriptar o hashear información sensible (ej. contraseñas). No almacenar claves API o credenciales en texto plano.
- Tasa límite (Rate Limiting): Implementar para proteger contra ataques de fuerza bruta y abuso de API.
- CORS: Configurar adecuadamente para permitir solo orígenes autorizados.
- Variables de entorno: Usar variables de entorno para configuraciones sensibles (claves API, credenciales de base de datos).
- Actualizaciones de dependencias: Mantener las dependencias actualizadas para mitigar vulnerabilidades conocidas.
## 17. Pruebas

Lineamientos:

- Implementar pruebas unitarias para funciones críticas y modelos de datos.
- Implementar pruebas de integración para los endpoints de la API.
- Asegurar una cobertura de pruebas adecuada para los flujos de negocio principales (cotizaciones, pedidos, inventario).
- Utilizar un framework de pruebas como Jest.
## 18. Despliegue y Monitoreo

Lineamientos:

- Vercel: Configurar el despliegue continuo en Vercel para las funciones serverless.
- Monitoreo: Implementar herramientas de monitoreo para:
  - Rendimiento de las funciones (latencia, errores).
  - Uso de Firestore (lecturas, escrituras).
  - Logs de errores y auditoría.
- Alertas: Configurar alertas para errores críticos o anomalías en el sistema.
## 19. Prioridad de Trabajo

Se recomienda la siguiente prioridad para las tareas del backend:

1. Definir y formalizar el contrato de datos para todas las colecciones clave (productos, clientes, cotizaciones, pedidos, inventario).
2. Implementar el flujo completo de cotizaciones con sus estados y transiciones, incluyendo notificaciones.
3. Implementar el flujo de pedidos desde la conversión de cotizaciones, incluyendo la integración con bodega y movimientos de inventario.
4. Desarrollar el módulo de bodega para preparación, inspección, aprobación y despacho.
5. Asegurar la validación de permisos y roles en todos los endpoints críticos.
6. Implementar el registro de auditoría para acciones clave.
7. Configurar el monitoreo y alertas para el entorno de producción.
8. Revisar y optimizar el rendimiento de los endpoints más utilizados.
