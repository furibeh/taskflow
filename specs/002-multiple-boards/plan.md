# Implementation Plan: Múltiples tableros (uno por equipo)

**Branch**: `002-multiple-boards` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-multiple-boards/spec.md`

## Summary

TaskFlow pasa de un tablero único a varios tableros independientes, uno por equipo, en la
misma instalación. Cualquiera puede crear un tablero desde la pantalla de inicio (con límite
por IP y un interruptor para desactivarlo); el enlace secreto se muestra una sola vez. Cada
enlace da acceso a un único tablero, con aislamiento total de tareas y personas. El tablero
tiene un nombre visible que se puede cambiar y se puede borrar de forma definitiva
confirmando con su nombre. La consola permite crear, listar, regenerar y borrar tableros.

Enfoque técnico: se aprovecha que `board_id` ya está en todas las tablas (D7) y que la
autenticación ya resuelve el tablero por su código. Se añaden: una migración (`name`,
`updated_at`), casos de uso de tablero en el dominio, dos rutas públicas (`GET
/v1/public-config`, `POST /v1/boards`) fuera del ámbito autenticado, `PATCH`/`DELETE
/v1/board`, comandos de consola nuevos y, en la web, la pantalla de inicio, el flujo de
creación y la gestión del tablero. La creación es idempotente con el id generado por el
cliente; el código lo sigue generando el servidor y solo se devuelve en el `201` (R19). Detalle y alternativas en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`) sobre Node.js 24 LTS; ES modules (sin cambios)

**Primary Dependencies**: las de la 001 (Fastify 5, `fastify-type-provider-zod`, Zod 4,
Kysely + `pg`, `@fastify/helmet`, `@fastify/rate-limit`; React 19, Vite, TanStack Query,
`@dnd-kit/core`). **Sin dependencias nuevas**: argumentos de consola con `node:util.parseArgs`

**Storage**: PostgreSQL 17; nueva migración `0005_board_name` con `up`/`down`

**Testing**: Vitest (dominio con repositorios en memoria, API con `app.inject()` contra la BD
de pruebas, contrato contra `specs/002-multiple-boards/contracts/openapi.yaml`, web con Testing
Library + `vitest-axe`), Playwright + axe (E2E), pruebas de la CLI y de la migración

**Target Platform**: servidor Linux en contenedores; navegadores modernos (sin cambios)

**Project Type**: aplicación web (SPA + API REST) en monorepo (sin cambios)

**Performance Goals**: con 100 tableros, abrir y operar un tablero mantiene SC-003 de la 001
(< 1 s con 200 tareas) — SC-106. Las consultas ya filtran por `board_id` con índice

**Constraints**: las de la 001 (pesimista, timeout 10 s, WCAG 2.1 AA, 320 px, 16 KiB) más:
el código de acceso solo en la respuesta `201` de la creación (`no-store`), nunca en
repeticiones, logs ni errores; límite de creación por
IP en memoria (una instancia de API)

**Scale/Scope**: cientos de tableros por instalación, cada uno con el volumen de la 001; 1
instancia de API; pantallas nuevas: inicio y diálogos de enlace nuevo, renombrar y borrar

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Código modular | Lo nuevo vive en los módulos existentes (`domain/board`, `use-cases/board`, `contracts/board`, `routes/board`, `features/access`) y en `features/home`; dependencias unidireccionales verificadas con `dependency-cruiser` | ✅ |
| II. Dominio independiente de la interfaz | Validación del nombre, idempotencia de la creación y borrado en casos de uso puros; la interfaz solo compara el texto de confirmación (presentación) | ✅ |
| III. Validación de toda entrada | Esquemas Zod estrictos para `CreateBoardRequest` (id y nombre) y `RenameBoardRequest`; nombre validado en el dominio; pertenencia al tablero comprobada en cada operación y probada entre dos tableros (R27); argumentos de consola validados | ✅ |
| IV. Pruebas de operaciones importantes | Unitarias de `createBoard`, `renameBoard`, `deleteBoard`, `listBoards`; integración de rutas nuevas, aislamiento, límite y desactivación; contrato; migración `0005` up/down; CLI; web y E2E | ✅ |
| V. Secretos fuera del repositorio | Variables nuevas sin secretos (`BOARD_CREATION_ENABLED`, `BOARD_CREATION_PER_HOUR`) en `.env.example`; el código lo genera el servidor, solo se guarda su hash y solo sale en la respuesta `201` | ✅ |
| VI. Migraciones | `0005_board_name` versionada, reversible y probada | ✅ |
| Seguridad y datos | Autorización por código en toda operación sobre un tablero existente; las dos rutas públicas (`GET /v1/public-config`, `POST /v1/boards`) no leen ni modifican datos de ningún tablero existente y están limitadas (D12); FK de un tablero borrado → `401` genérico; sin detalles internos en errores | ✅ con excepción justificada (ver Complexity Tracking) |
| Definición de terminado | `npm test` + `npm run test:e2e` en verde para cerrar cada tarea | ✅ |
| Explicar decisiones de arquitectura/seguridad antes de aplicarlas | Sección **Decisiones que requieren aprobación** (D12–D16) | ✅ Aprobadas por el usuario el 2026-10-17 |

**Resultado**: sin violaciones. Decisiones D12–D16 aprobadas por el usuario el 2026-10-17
(D13 en su opción B); la puerta queda abierta para `/speckit-tasks` y `/speckit-implement`.

**Re-evaluación tras la Fase 1** (data-model, contrato, quickstart): sin cambios. El dominio
no gana dependencias, todas las entradas nuevas del contrato tienen
`additionalProperties: false` y el único cambio de esquema tiene migración reversible.

## Arquitectura

Cambios sobre el diagrama de la 001 (`specs/001-kanban-task-board/plan.md`):

```text
apps/api  /api
  ├─ /health                                  (público, sin cambios)
  └─ /v1
      ├─ ámbito público ─────────────────────────────────────────────┐
      │   GET  /public-config   → { boardCreationEnabled }           │ sin auth
      │   POST /boards          → createBoard  [interruptor, límite  │
      │                           por IP/hora, idempotente]          │
      └─ ámbito autenticado (plugin auth: código → tablero) ─────────┘
          GET/PATCH/DELETE /board              → getBoardDetails / renameBoard / deleteBoard
          POST /board/access-code/regenerate   (sin cambios)
          /tasks…, /people…                    (sin cambios; ya filtran por board_id)

packages/domain  use-cases/board.ts: createBoard, initBoard, renameBoard, deleteBoard,
                 getBoardDetails, listBoards, resolveBoard, regenerateAccessCode
apps/api/cli     board:create, board:init, board:list, board:rotate --board, board:delete --board
apps/web         features/home (inicio, crear, aviso del enlace) · cabecera con nombre ·
                 features/access (renombrar, borrar, enlace no válido + crear)
```

## Endpoints de la API

Contrato completo: [contracts/openapi.yaml](./contracts/openapi.yaml) (versión 1.1.0).

| Método | Ruta | Auth | Caso de uso | Requisitos |
|---|---|---|---|---|
| GET | `/api/v1/public-config` | No | — (configuración) | FR-106, FR-107 |
| POST | `/api/v1/boards` | No | `createBoard` (id del cliente, idempotente; código solo en `201`) | FR-102–FR-105 |
| GET | `/api/v1/board` | Sí | `getBoardDetails` (ahora con `name`, `taskCount`, `personCount`) | FR-113, FR-115 |
| PATCH | `/api/v1/board` | Sí | `renameBoard` | FR-114 |
| DELETE | `/api/v1/board` | Sí | `deleteBoard` (físico, cascada) | FR-115–FR-117 |
| POST | `/api/v1/board/access-code/regenerate` | Sí | sin cambios (además actualiza `updated_at`) | FR-028b, FR-111 |
| resto | `/api/v1/tasks…`, `/api/v1/people…` | Sí | sin cambios | FR-108–FR-110 |

## Validación y manejo de errores

Flujo de la 001 sin cambios para las rutas autenticadas. Para `POST /v1/boards`:

1. Límites global y de escrituras por IP (D5) → `429 RATE_LIMITED`.
2. Interruptor: si `BOARD_CREATION_ENABLED=false` → `403 BOARD_CREATION_DISABLED`.
3. Límite de creación por IP: si está agotado → `429 BOARD_CREATION_LIMITED` + `Retry-After`.
4. Esquema Zod estricto → `400 VALIDATION_ERROR`.
5. `createBoard` → `201` con el código (nuevo, cuenta para el límite) / `200` sin código
   (repetición de un tablero ya creado, no cuenta) / `409 ID_CONFLICT`. Respuestas con
   `Cache-Control: no-store`.

Errores nuevos y traducción en la interfaz (`apps/web/src/i18n/es.ts`):

| Código | HTTP | Mensaje mostrado al usuario |
|---|---|---|
| `VALIDATION_ERROR` (`name`) | 400 | "El nombre es obligatorio" / "Máximo 60 caracteres" |
| `BOARD_CREATION_DISABLED` | 403 | "En esta instalación no se pueden crear tableros desde la web. Pide el enlace a tu equipo." |
| `BOARD_CREATION_LIMITED` | 429 | "Has creado demasiados tableros. Inténtalo más tarde." |
| `ID_CONFLICT` (creación) | 409 | "No se pudo crear el tablero. Inténtalo de nuevo." (el cliente regenera el id) |
| `200` en la creación (repetición) | 200 | "El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero." (el cliente regenera el id) |
| `INVALID_LINK` tras borrar | 401 | El de la 001; la página ofrece además "Crear un tablero nuevo" |
| `BOARD_NOT_FOUND` (renombrar o borrar un tablero recién borrado) | 401 | Como `INVALID_LINK` |

Violación de FK sobre `board_id` (escritura en vuelo durante un borrado) → `401 INVALID_LINK`
en el manejador único de errores (R20).

## Decisiones que requieren aprobación

Según la constitución, estas decisiones se explican aquí antes de aplicarse. **Aprobadas por
el usuario el 2026-10-17** (D13 tras elegir la opción B). D1–D11 de la 001 siguen vigentes
salvo D4, que queda sustituida por D12.

| # | Tipo | Decisión | Problema que resuelve | Alternativas descartadas | Impacto / riesgo |
|---|---|---|---|---|---|
| D12 | SEG | **Creación pública de tableros** (`POST /v1/boards` sin autenticación) con límite propio por IP real (10/h por defecto, `BOARD_CREATION_PER_HOUR`), interruptor `BOARD_CREATION_ENABLED` y los límites de D5. **Sustituye a D4** (R18) | FR-102: cualquiera crea un tablero sin cuentas ni intervención de quien administra | CAPTCHA/prueba de trabajo (dependencia externa, accesibilidad); clave de instancia (contradice FR-102); tope global (un atacante bloquea a todos) | Cualquiera que alcance la instalación puede crear tableros y ocupar espacio, contenido a 10/h por IP; el límite vive en memoria y se reinicia al reiniciar la API; detrás de un NAT, una oficina comparte el límite |
| D13 | SEG | **Creación idempotente con código del servidor** (opción B elegida por el usuario): el cliente genera solo el `id`; el servidor genera el código (como D3) y lo devuelve **solo en el `201`** con `no-store`; una repetición del mismo `id` y nombre → `200` sin código y la web avisa de que el tablero se creó sin poder mostrar su enlace (R19) | FR-103 y FR-104: no duplicar tableros en reintentos ni volver a mostrar ni guardar en claro el código | (A) código generado por el cliente (rompe D3, oráculo en `409`); (C) testigo de creación que permite regenerar el código en un reintento (secreto temporal y ventana extra) | Si la respuesta del `201` se pierde, el tablero queda **huérfano** (vacío y sin enlace); quien administra lo borra con `board:list`/`board:delete`. Caso raro; no se recupera |
| D14 | SEG/ARQ | **Borrado físico e inmediato del tablero** por cualquier poseedor del enlace, en cascada sobre personas y tareas, sin deshacer; la FK de una escritura en vuelo se traduce a `401 INVALID_LINK` (R20) | FR-115–FR-117 con la clarificación "definitivo de inmediato" | Borrado lógico con purga diferida (rechazado en la clarificación); confirmación del nombre también en el servidor (no protege frente a quien ya tiene el enlace) | **Riesgo aceptado**: un enlace filtrado permite borrar todos los datos del equipo sin vuelta atrás; solo se recuperan con copias de seguridad (fuera de alcance, 001) |
| D15 | ARQ | **Migración `0005_board_name`**: `name` (1–60, `'Mi tablero'` para las filas existentes, sin `DEFAULT` después) y `updated_at` (= `created_at`); reversible (R21) | FR-112, FR-118 y "última actividad" (R24) | Nombre nulo con valor por defecto en la interfaz (regla fuera del dominio); columna `last_activity_at` mantenida en cada escritura (toca todos los repositorios) | Cambio de esquema compatible; `down` pierde los nombres |
| D16 | ARQ | **Ámbito público en `/api/v1`** (`public-config` y `boards`) separado del autenticado, y **contrato vigente en `specs/002-multiple-boards/contracts/openapi.yaml`** (1.1.0), al que apuntan las pruebas de contrato (R22, R25) | FR-106/FR-107 necesitan configuración sin enlace; un único contrato vigente | Variable de compilación de Vite (desincroniza web y API); editar el contrato de la 001 (mezcla features) | Primeras rutas `/v1` sin autenticación: deben quedar explícitas en el contrato (`security: []`) y cubiertas por pruebas que verifiquen que no exponen datos de ningún tablero |

Decisiones sin impacto de arquitectura ni seguridad (no requieren aprobación aparte): comandos
de consola (R23), cálculo derivado de la última actividad (R24), estructura de la interfaz
(R26) y estrategia de pruebas de aislamiento (R27).

**Fuera de alcance**: copias de seguridad (sigue pendiente de la feature de despliegue; con
D14 pasa a ser la única recuperación ante un borrado); limpieza automática de tableros
abandonados; FK compuesta para asignaciones (anotada en R27).

## Project Structure

### Documentation (this feature)

```text
specs/002-multiple-boards/
├── plan.md              # Este archivo
├── research.md          # Fase 0: R18–R27
├── data-model.md        # Fase 1: Board modificada, puerto, casos de uso, migración 0005
├── quickstart.md        # Fase 1: validación de extremo a extremo
├── contracts/
│   └── openapi.yaml     # Fase 1: contrato completo vigente (1.1.0)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

Solo los archivos que se crean (＋) o modifican (～); el resto de la estructura es la de la 001.

```text
.env.example                                   ～ BOARD_CREATION_ENABLED, BOARD_CREATION_PER_HOUR
docker-compose.yml                             ～ variables nuevas en api (migrate sigue con board:init)
CLAUDE.md, README.md                           ～ varios tableros, comandos nuevos, D12–D16

packages/domain/src/
├── board/board.ts                             ～ Board.name/updatedAt, BoardName, BoardSummary, puerto
├── shared/limits.ts                           ～ BOARD_NAME_MIN/MAX, DEFAULT_BOARD_NAME
├── shared/errors.ts                           ～ BOARD_NOT_FOUND
└── use-cases/board.ts                         ～ createBoard, renameBoard, deleteBoard, getBoardDetails, listBoards
packages/domain/tests/
├── support/in-memory.ts                       ～ repositorio de tableros en memoria
└── unit/use-cases/board.test.ts               ～

packages/contracts/src/
├── board.ts                                   ～ BoardSchema, CreateBoardRequest, CreatedBoard(WithCode), RenameBoardRequest, PublicConfig
└── problem.ts                                 ～ BOARD_CREATION_DISABLED, BOARD_CREATION_LIMITED

apps/api/src/
├── config/env.ts                              ～ variables nuevas validadas
├── http/app.ts                                ～ ámbito público + autenticado; opciones de creación
├── http/plugins/error-handler.ts              ～ FK de board_id → 401 INVALID_LINK
├── http/routes/board.ts                       ～ PATCH/DELETE /board, GET con recuentos
├── http/routes/boards.ts                      ＋ POST /boards (interruptor + límite) y GET /public-config
├── persistence/db.ts                          ～ BoardTable.name/updated_at
├── persistence/migrations/0005_board_name.ts  ＋ (registrada en migrations/index.ts)
├── persistence/repositories/board-repository.ts ～ métodos nuevos del puerto
└── cli/                                       ＋ board-create.ts, board-list.ts, board-delete.ts, args.ts
                                               ～ board-init.ts, board-rotate.ts (--board)
apps/api/package.json                          ～ scripts board:create, board:list, board:delete
apps/api/tests/
├── contract/openapi.ts                        ～ ruta del contrato de la 002
├── contract/boards.contract.test.ts           ＋
├── integration/boards-create.test.ts          ＋ creación, repetición sin código, límite, interruptor, código ausente de los logs
├── integration/board-manage.test.ts           ＋ renombrar, borrar, peticiones tras borrar, FK en vuelo
├── integration/board-isolation.test.ts        ＋ aislamiento entre dos tableros (R27)
├── migrations/migrations.test.ts              ～ 0005 up/down con datos
└── cli/board-cli.test.ts                      ～ create, list, rotate --board, delete

apps/web/src/
├── api/board.ts                               ～ useBoard, useRenameBoard, useDeleteBoard
├── api/boards.ts                              ＋ usePublicConfig, useCreateBoard
├── api/client.ts                              ～ opción para peticiones sin Authorization
├── app/App.tsx                                ～ inicio / enlace no válido / tablero; nombre en cabecera y título
├── app/access-code.ts                         ～ clearAccessCode()
├── features/home/                             ＋ HomePage, CreateBoardForm, NewBoardLinkDialog
├── features/access/                           ～ InvalidLinkPage (+ crear), RenameBoardDialog, DeleteBoardDialog
└── i18n/es.ts                                 ～ textos y códigos de error nuevos
apps/web/tests/{home,access}/                  ＋ componentes nuevos con Testing Library + axe

e2e/
├── global-setup.ts                            ～ board:create en lugar de board:init + board:rotate
└── tests/boards.spec.ts                       ＋ crear → abrir → aislamiento → renombrar → borrar (escritorio y 320 px)
```

**Structure Decision**: se mantiene el monorepo de la 001. La gestión del tablero se queda en
el módulo `board` de cada capa; la única carpeta nueva de la web, `features/home`, agrupa lo
que se ve sin enlace (inicio y creación), separado de `features/access`, que actúa sobre el
tablero abierto.

## Complexity Tracking

| Regla de la constitución | Excepción | Justificación | Alternativa más estricta descartada |
|---|---|---|---|
| "Autenticación y autorización DEBEN verificarse en el servidor para cada operación sobre tableros" (Requisitos de Seguridad y Datos) | `POST /v1/boards` y `GET /v1/public-config` no exigen código de acceso | Crear un tablero no opera sobre recursos de ningún equipo: el tablero nuevo no existe hasta la creación y su creador recibe el único código que da acceso a él. `public-config` solo expone `boardCreationEnabled`. Ninguna ruta pública devuelve, modifica ni confirma datos de un tablero existente (lo verifican T019 y T052). Mitigaciones: límite por IP, interruptor y límites de D5 (D12, aprobada el 2026-10-17) | Exigir una clave de instancia para crear (contradice FR-102); no ofrecer creación web (contradice la decisión del usuario) |
