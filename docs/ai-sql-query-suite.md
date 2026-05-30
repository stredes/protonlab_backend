# Suite de consultas SQL para IA ProtonLab

Esta suite valida el proceso completo del asistente SQL: interpretar una pregunta de negocio, construir prompt con contexto ERP, generar SQL de solo lectura y devolver una respuesta humana breve con evidencia y supuestos.

Archivo automatizado:

```bash
npx vitest run tests/server/sql-assistant-query-suite.test.ts
```

## Proceso validado

1. El usuario realiza una pregunta administrativa en lenguaje natural.
2. El backend agrega dialecto SQL, contexto de negocio y AI Context Registry de ProtonLab.
3. El proveedor IA debe responder JSON valido con `sql`, `answer`, `explanation`, `assumptions`, `evidence` y `notice`.
4. El backend valida que el SQL sea de solo lectura, empiece con `SELECT` o `WITH`, no tenga multiples sentencias y no contenga operaciones destructivas.
5. La respuesta final entrega una explicacion humana y trazabilidad minima para el ERP.

## Preguntas cubiertas

| Dominio | Pregunta | Resultado esperado |
| --- | --- | --- |
| Pedidos | `Cuantos pedidos hay por estado operativo` | Conteo agrupado por `orders.status`. |
| Facturacion | `Muestra ordenes con pago pendiente y total mayor a cero` | Pedidos con `paymentStatus = 'pendiente'`. |
| Pedidos | `Ventas confirmadas del mes por estado` | Venta mensual por estados operativos. |
| Cotizaciones | `Cotizaciones pendientes de aprobacion por vendedor` | Cotizaciones activas por vendedor y estado. |
| Cotizaciones | `Tasa de conversion de cotizaciones a pedido` | Porcentaje de `quotes.status = 'convertida'`. |
| Soporte | `Tickets de soporte por prioridad y estado` | Tickets agrupados por prioridad y estado. |
| Catalogo | `Productos sin imagen principal en blob` | Productos sin imagen primaria en `productImages`. |
| Catalogo | `Productos con stock bajo menor a cinco unidades` | Productos con `stock < 5`. |
| Clientes | `Top clientes por monto total comprado` | Clientes ordenados por monto comprado. |
| Bodega | `Pedidos que bodega debe preparar o despachar` | Pedidos en `confirmado` o `procesando`. |

## Controles de seguridad

La suite tambien valida que el backend rechace respuestas del modelo con multiples sentencias o SQL destructivo, por ejemplo una respuesta que mezcle:

```sql
SELECT * FROM orders; DROP TABLE orders;
```

Ese caso debe fallar antes de entregar respuesta al usuario.
