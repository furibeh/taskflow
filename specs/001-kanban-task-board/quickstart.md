# Quickstart: Validación de TaskFlow v1

**Plan**: [plan.md](./plan.md) | **Contrato**: [contracts/openapi.yaml](./contracts/openapi.yaml)
| **Modelo**: [data-model.md](./data-model.md)

Guía para levantar TaskFlow en local y comprobar de extremo a extremo que la funcionalidad
cumple la spec. Se ejecuta tras la implementación (`/speckit-implement`).

## Requisitos previos

- Docker Engine 24+ con Docker Compose v2.
- Node.js 24 LTS y npm 10+ (solo para ejecutar pruebas fuera de contenedores).
- Puertos libres: `5173` (web), `3000` (API), `5432` (PostgreSQL).

## 1. Configuración

```bash
cp .env.example .env        # valores locales; .env nunca se sube al repositorio
npm ci
```

Comprobación: `git check-ignore .env` imprime `.env`.

Opcional: los límites de peticiones por IP y minuto se ajustan en `.env` con
`RATE_LIMIT_GLOBAL` (300), `RATE_LIMIT_WRITES` (60) y `RATE_LIMIT_UNAUTHORIZED` (20). Pueden
subirse, pero no desactivarse (mínimo 1).

## 2. Arranque

```bash
docker compose up --build
```

Resultado esperado:

- El servicio `migrate` aplica las migraciones `0001`–`0004` y termina con código 0.
- En su salida aparece **una sola vez** el enlace de acceso:
  `Enlace del tablero: http://localhost:5173/#k=<código de 43 caracteres>`.
  En arranques posteriores indica que el tablero ya existe y no vuelve a mostrar el código.
- `curl -s http://localhost:3000/api/health` → `{"status":"ok"}`.

Si se pierde el enlace: `docker compose run --rm migrate npm run board:rotate -w apps/api`.

## 3. Pruebas automatizadas

```bash
docker compose up -d db-test
npm test               # dominio + API (con PostgreSQL de pruebas) + web
npm run test:e2e       # Playwright: escritorio y 320 px, con auditoría de accesibilidad
npm run lint           # incluye la verificación de límites entre paquetes
```

Resultado esperado: todas las suites en verde. Según la constitución, ninguna tarea se da
por terminada si alguna falla.

## 4. Validación manual de los escenarios

Abrir el enlace del paso 2. Cada bloque referencia la historia de usuario de la spec.

| # | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | Tablero vacío (US1) | Abrir el enlace | Tres columnas con contador 0 y mensaje orientativo |
| 2 | Crear tarea (US1) | Crear "Preparar demo" con descripción | Aparece en Pendiente tras "Guardando…"; el formulario se vacía |
| 3 | Título inválido (US1) | Crear con título "   " | Mensaje junto al campo; no se crea nada |
| 4 | Persistencia (US1, SC-009) | Recargar; abrir el enlace en otro navegador | La tarea aparece en ambos |
| 5 | Personas (US6) | Añadir "Ana" y "Luis"; intentar "ana" | Ana y Luis añadidos; "ana" rechazado como repetido |
| 6 | Asignar (US3) | Asignar la tarea a Ana | La tarjeta muestra "Ana" |
| 7 | Sin responsable (US3) | Quitar asignación y mover a Hecha | "Sin asignar" con icono; el cambio se permite |
| 8 | Cambio de estado por teclado (US2) | Solo con teclado, mover a En progreso | Cambia de columna; se anuncia el nuevo estado |
| 8b | Arrastrar y soltar (US2, FR-019a) | A ≥ 768 px, arrastrar una tarjeta a Hecha con ratón; repetir con teclado (Espacio, flechas, Espacio) y cancelar otra con Escape | "Guardando…" y la tarjeta pasa a Hecha; los pasos se anuncian; Escape no cambia nada |
| 9 | Búsqueda (US4) | Crear "Revisión de diseño"; buscar "REVISION" | La tarea aparece (sin distinguir mayúsculas ni tildes) |
| 10 | Sin coincidencias (US4) | Buscar "zzz" | "No hay tareas que coincidan con «zzz»" + "Limpiar búsqueda y filtros" |
| 11 | Filtros combinados (US4) | Responsable Ana + estado Hecha; recargar | Solo tareas que cumplen ambos; filtros conservados |
| 12 | Borrar y deshacer (US5) | Borrar, confirmar, pulsar "Deshacer" | La tarea reaparece intacta |
| 13 | Borrado definitivo (US5) | Borrar y esperar 10 s | El aviso desaparece; la tarea no vuelve tras recargar |
| 14 | Quitar persona (US6) | Quitar a Ana con tareas asignadas | Confirmación con el número de tareas; quedan "Sin asignar" |
| 15 | Fallo de guardado (US2) | `docker compose stop api`; mover una tarea | Tras ≤ 10 s, error con "Reintentar"; la tarjeta no se mueve. `docker compose start api` y reintentar → se aplica una sola vez |
| 16 | Enlace regenerado (FR-028b) | Regenerar en una pestaña; operar en otra con el enlace antiguo | La segunda muestra "Enlace no válido" sin datos |
| 17 | Enlace incorrecto (FR-028c) | Abrir `http://localhost:5173/#k=incorrecto` | "Enlace no válido", sin revelar nada más |
| 18 | Texto peligroso (FR-010) | Crear tarea con título `<img src=x onerror=alert(1)>` | Se muestra como texto literal; no se ejecuta nada |
| 19 | Móvil (FR-032) | Herramientas de desarrollo a 320 px | Columnas como pestañas; sin desplazamiento horizontal |

## 5. Comprobaciones rápidas de la API

```bash
CODE=<código del enlace>
curl -s -H "Authorization: Bearer $CODE" http://localhost:3000/api/v1/tasks | jq .counts
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer x" \
  http://localhost:3000/api/v1/tasks                      # 401
curl -s -X POST -H "Authorization: Bearer $CODE" -H 'Content-Type: application/json' \
  -d '{"id":"7d9f1c2e-0000-4000-8000-000000000001","title":""}' \
  http://localhost:3000/api/v1/tasks | jq .code            # "VALIDATION_ERROR"
```

## 6. Migraciones

```bash
npm run db:migrate:down -w apps/api   # revierte la última migración sin errores
npm run db:migrate -w apps/api        # vuelve a aplicarla
```
