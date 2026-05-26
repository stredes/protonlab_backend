# Consultas rapidas para demo IA

Estas preguntas estan pensadas para responder rapido en vivo desde datos operativos reales o desde el contexto del ERP.

## Respuestas directas verificadas

- `cuantos usuarios existen`
  - Fuente: Firebase Auth.
  - Respuesta esperada: conteo real de usuarios con evidencia de los primeros usuarios.

- `cuantos susarios existen`
  - Fuente: Firebase Auth.
  - Uso: prueba de tolerancia a typo.

- `cuantos productos existen`
  - Fuente: catalogo operativo del backend.
  - Respuesta esperada: conteo real de productos con evidencia de SKU, disponibilidad y precio cuando existe.

- `lista productos`
  - Fuente: catalogo operativo del backend.
  - Respuesta esperada: resumen del catalogo y evidencia de productos.

## Consultas rapidas por modelo

- `genera una consulta para ver los ultimos 10 pedidos`
- `genera una consulta para contar pedidos por estado`
- `genera una consulta para listar cotizaciones pendientes`
- `genera una consulta para ver productos disponibles`
- `genera una consulta para contar tickets de soporte por estado`
- `genera una consulta para listar usuarios por rol`

## Recomendacion de demo

Para la presentacion, comenzar con las respuestas directas verificadas. Luego usar una consulta por modelo para mostrar generacion SQL, aclarando que el SQL es de solo lectura y debe validarse antes de ejecutarse en una base productiva.
