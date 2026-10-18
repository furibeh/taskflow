# Quickstart Run: Múltiples tableros

**Fecha**: 2026-10-18 | **Guía**: [quickstart.md](../quickstart.md) | **Tareas**: T054, T055, T056

Registro de la validación del quickstart de la feature 002. Las secciones automatizables las
ejecutó el asistente sobre una instalación aislada (`docker compose -p taskflow-qs`, con su
propio volumen, desmontada al terminar). La medición de SC-101 y la revisión con lector de
pantalla (T056) las hizo el usuario (sección 8).

## 1. Configuración nueva

| Comprobación | Resultado |
|---|---|
| `BOARD_CREATION_ENABLED` y `BOARD_CREATION_PER_HOUR` en `.env.example` y en el servicio `api` de Compose | ✅ |
| Valores inválidos (`yes`, `0`, `abc`) impiden arrancar | ✅ (`env.test.ts`) |

## 2. Actualización de una instalación existente (FR-118, SC-105)

Se dejó la base de datos en el esquema de la 001 (`0004`) con un tablero, una persona y una
tarea asignada, y un código conocido; después, `docker compose up`.

| Comprobación | Resultado |
|---|---|
| `migrate` aplica `0005_board_name` y `board:init` no crea otro tablero | ✅ |
| El enlace anterior sigue funcionando (API directa y a través del proxy de la web) | ✅ |
| El tablero se llama "Mi tablero" y conserva su tarea y su responsable | ✅ `taskCount: 1`, `personCount: 1`, "Tarea de la 001 → Ana" |

Hallazgo corregido durante la validación: el mensaje de `board:init` con tableros existentes
recomendaba `board:rotate` sin `--board`, que falla si hay varios; ahora remite a `board:list` y
`board:rotate -- --board <id>`.

## 3. Pruebas automatizadas (T055)

| Suite | Resultado |
|---|---|
| `npm run lint`, `npm run lint:deps`, `npm run typecheck` | ✅ sin errores |
| `npm test` (dominio 78, contratos 5, API 149, web 83) | ✅ 315/315 |
| `npm run test:e2e` | ✅ 66 pasan, 4 omitidas a propósito (las mismas de la 001: arrastre y rendimiento en 320 px, regeneración en un solo proyecto) |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades |

Tiempos con 100+ tableros y 200 tareas en el tablero medido (SC-003, SC-106, objetivo < 1 s):
carga 410 ms, búsqueda 900 ms (incluye 300 ms de espera deliberada), filtro 495 ms, cambio de
estado 153 ms; equivalentes a los de la 001 con un solo tablero.

## 4. Escenarios manuales

| # | Escenario | Cubierto por |
|---|---|---|
| 1, 2, 5 | Inicio sin enlace, crear, copiar y abrir | `boards.spec.ts` (US1), `create-board.test.tsx` |
| 1b | Primer uso en < 60 s (SC-101) | ✅ manual (usuario): el flujo se completa en menos de 60 s |
| 3 | Nombre inválido | `create-board.test.tsx`, `boards-create.test.ts` |
| 3b | Respuesta perdida al crear (FR-104) | `create-board.test.tsx`, `boards-create.test.ts` (repetición `200` sin código) |
| 4 | Cerrar sin copiar (FR-103a), incluido Escape | `boards.spec.ts`, `create-board.test.tsx` |
| 6, 7 | Aislamiento y regeneración independiente (US2) | `boards.spec.ts`, `board-isolation.test.ts` |
| 8, 9 | Renombrar y fallo al renombrar (US3) | `boards.spec.ts`, `board-settings.test.tsx` |
| 10, 11 | Borrar y enlace tras borrar (US4) | `boards.spec.ts`, `board-settings.test.tsx`, `board-manage.test.ts` |
| 12 | Límite de creación | ✅ manual: con `BOARD_CREATION_PER_HOUR=2`, la tercera creación a través del proxy da `429 BOARD_CREATION_LIMITED` |
| 13 | Creación desactivada | ✅ manual: `public-config` → `false` y `POST /boards` → `403 BOARD_CREATION_DISABLED` |
| 14 | Teclado y 320 px (SC-107) | `boards.spec.ts` en `mobile-320` con axe; lector de pantalla en la sección 8 |

## 5. Consola (FR-119)

| Comando | Resultado |
|---|---|
| `board:create --name "Equipo Infra"` | ✅ enlace impreso una vez |
| `board:list` | ✅ id, nombre, creación, tareas, personas y última actividad; sin códigos |
| `board:rotate --board <id>` | ✅ enlace nuevo; sin `--board` con varios tableros: "Hay varios tableros: indica --board <id>" |
| `board:delete --board <id> --confirm "<otro>"` | ✅ "El nombre no coincide: no se ha borrado nada." |
| `board:delete --board <id> --confirm "<nombre>"` | ✅ "Tablero «Equipo Infra» borrado (0 tareas y 0 personas)." |
| `board:rotate --board <id inexistente>` | ✅ "No existe ningún tablero con ese id", salida 1 |

## 6. Comprobaciones rápidas de la API

| Comprobación | Resultado |
|---|---|
| `GET /public-config` | ✅ `{"boardCreationEnabled":true}` |
| `POST /boards` | ✅ `201`, `Cache-Control: no-store`, código de 43 caracteres |
| Repetición del mismo `POST` | ✅ `200` sin `accessCode` |
| `GET /board` con el código | ✅ nombre "Prueba" y recuentos |
| `DELETE /board` y después `GET /board` | ✅ `204`, después `401 INVALID_LINK` |
| El código no aparece en los logs de la API | ✅ 0 apariciones |

## 7. Migración

| Comprobación | Resultado |
|---|---|
| `db:migrate:down` revierte `0005` sin perder tareas ni personas | ✅ |
| `db:migrate` la vuelve a aplicar; los tableros se llaman "Mi tablero" (D15: `down` pierde los nombres) | ✅ |

## 8. Pruebas manuales del usuario (SC-101, T056)

Sobre la instalación aislada, con Firefox y Orca 50.3 (KDE, Wayland), solo con teclado.

| # | Paso | Resultado |
|---|---|---|
| — | SC-101: crear un tablero, copiar el enlace y crear la primera tarea | ✅ en menos de 60 s |
| 1 | Pantalla de inicio | ✅ |
| 2 | Validación del nombre | ✅ |
| 3 | Crear: "Guardando…" y diálogo con el enlace | ✅ |
| 4 | Cerrar sin copiar (FR-103a) | ❌ → ✅ Orca no anunciaba la pregunta; corregido y vuelto a probar con Orca: OK |
| 5 | Copiar ("Enlace copiado") y abrir | ✅ |
| 6 | Menú "Tablero" (contraído/expandido) y renombrar | ✅ |
| 7 | Borrar: aviso, botón no disponible hasta escribir el nombre, aviso final | ✅ |

**Defecto del paso 4 y corrección**: la pregunta aparecía sin mover el foco y fuera de una región
`aria-live`. Ahora el foco pasa a "Cancelar", dentro del grupo etiquetado con la pregunta (el
lector la lee al entrar), y al cancelar vuelve a "Copiar enlace". Pruebas de regresión en
`create-board.test.tsx` y `boards.spec.ts` (foco comprobado en Chromium). El usuario repitió el
paso 4 con Orca sobre la corrección: se anuncia la pregunta y "Cancelar".

