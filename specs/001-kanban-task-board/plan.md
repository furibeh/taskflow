# Implementation Plan: Tablero Kanban de Tareas (TaskFlow v1)

**Branch**: `001-kanban-task-board` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-kanban-task-board/spec.md`

## Summary

TaskFlow v1 es un tablero kanban compartido (Pendiente / En progreso / Hecha) para equipos
pequeños, sin inicio de sesión: el acceso se controla con un enlace secreto regenerable. Permite
crear, editar, borrar (con "Deshacer" de 10 s), asignar y cambiar de estado tareas (con un
control explícito o arrastrando la tarjeta), gestionar
la lista de personas, y buscar/filtrar por texto, responsable y estado. La interfaz es
accesible (WCAG 2.1 AA) y usable desde 320 px.

Enfoque técnico: monorepo TypeScript con un **paquete de dominio puro** (entidades, reglas y
casos de uso sin E/S), un **paquete de contratos** (esquemas Zod compartidos), una **API REST
Fastify** que adapta HTTP y PostgreSQL a los puertos del dominio, y una **SPA React** que solo
consume la API. Validación en la frontera HTTP y en el dominio, errores RFC 9457, escrituras
pesimistas e idempotentes, ejecución local con Docker Compose. Detalle y alternativas en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (`strict`) sobre Node.js 24 LTS; ES modules

**Primary Dependencies**: Backend: Fastify 5, `fastify-type-provider-zod`, Zod,
Kysely + `pg`, `@fastify/helmet`, `@fastify/rate-limit`, pino. Frontend: React 19, Vite,
TanStack Query, `@dnd-kit/core`. Compartido: Zod

**Storage**: PostgreSQL 17 (extensión `unaccent`); migraciones Kysely `up`/`down`

**Testing**: Vitest (dominio, API, web), `app.inject()` + PostgreSQL de pruebas para la API,
Testing Library + `vitest-axe` (web), Playwright + `@axe-core/playwright` (E2E)

**Target Platform**: Servidor Linux en contenedores; navegadores modernos de escritorio y
móvil (dos últimas versiones)

**Project Type**: Aplicación web (SPA + API REST) en monorepo

**Performance Goals**: con 200 tareas, cargar el tablero, buscar, filtrar o cambiar un estado
se refleja en < 1 s en red móvil típica (SC-003)

**Constraints**: sin inicio de sesión ni tiempo real; escrituras confirmadas antes de mostrarse;
timeout de cliente 10 s; deshacer 10 s (servidor 15 s); WCAG 2.1 AA; 320 px sin scroll
horizontal; áreas táctiles ≥ 44×44 px; cuerpos de petición ≤ 16 KiB

**Scale/Scope**: 1 tablero, ≤ ~15 personas, cientos de tareas activas; 1 instancia de API;
1 pantalla principal + diálogos (detalle/edición, personas, enlace)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Código modular | Paquetes `domain`, `contracts`, `api`, `web`; módulos por capacidad (`tasks`, `people`, `board`); dependencias unidireccionales verificadas con `dependency-cruiser` en CI | ✅ |
| II. Dominio independiente de la interfaz | `packages/domain` sin dependencias de React, Fastify ni PostgreSQL; casos de uso contra puertos; la regla de búsqueda vive en el servidor (R12) | ✅ |
| III. Validación de toda entrada | Esquemas Zod estrictos en body/params/query/cabeceras + invariantes en dominio; la validación del cliente es solo ayuda (R5) | ✅ |
| IV. Pruebas de operaciones importantes | Unitarias de todos los casos de uso; API contra BD real; contrato vs. OpenAPI; migraciones `up/down`; E2E con axe (R15) | ✅ |
| V. Secretos fuera del repositorio | `.env` ignorado, `.env.example` ficticio, configuración validada al arrancar; el código de acceso solo se guarda hasheado y viaja en el fragmento de la URL (R7, R16) | ✅ |
| VI. Migraciones | 4 migraciones Kysely versionadas con `up`/`down` probadas (data-model.md) | ✅ |
| Seguridad y datos | Autorización por código en cada petición; errores sin detalles internos; dependencias fijadas y `npm audit` en CI (R7, R8, R14) | ✅ |
| Definición de terminado | `npm test` + `npm run test:e2e` en verde son condición para cerrar cada tarea | ✅ |
| Explicar decisiones de arquitectura/seguridad antes de aplicarlas | Sección **Decisiones que requieren aprobación** abajo (D1–D10) | ✅ Aprobadas por el usuario el 2026-10-17 |

**Resultado**: sin violaciones. Decisiones D1–D10 aprobadas por el usuario el 2026-10-17; la
puerta queda abierta para `/speckit-implement`.

**Re-evaluación tras la Fase 1** (data-model, contrato, quickstart): sin cambios. El diseño no
introduce dependencias del dominio hacia infraestructura, todas las entradas del contrato
tienen esquema con `additionalProperties: false`, y cada cambio de esquema tiene migración.

## Arquitectura

```text
┌───────────────────────────── navegador ─────────────────────────────┐
│ apps/web (React)                                                    │
│  UI accesible ─▶ hooks TanStack Query ─▶ cliente HTTP (fetch, 10 s) │
│                                  │ valida respuestas con contracts  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ HTTPS · JSON · Authorization: Bearer <código>
┌──────────────────────────────────▼──────────────────────────────────┐
│ apps/api (Fastify)                                                  │
│  adaptadores de entrada: rutas  ─ validan con contracts (Zod)       │
│  plugins: auth (código→tablero), errores RFC 9457, rate limit, helmet│
│        │ invoca                                                     │
│        ▼                                                            │
│  packages/domain: casos de uso ─▶ puertos (TaskRepository, …)       │
│        ▲ implementa                                                 │
│  adaptadores de salida: repositorios Kysely ─────────────┐          │
└──────────────────────────────────────────────────────────┼──────────┘
                                                           ▼
                                                  PostgreSQL 17
```

### Límites entre capas

| Capa | Responsabilidad | Puede depender de | Nunca |
|---|---|---|---|
| `packages/domain` | Entidades, objetos valor (`TaskTitle`, `PersonName`, `TaskStatus`), reglas, casos de uso, puertos, errores de dominio | nada (solo la librería estándar) | E/S, HTTP, SQL, React, Zod |
| `packages/contracts` | Esquemas Zod de petición/respuesta, códigos de error, tipos DTO | `domain` (constantes y tipos) | lógica de negocio |
| `apps/api` | Rutas HTTP, autenticación por código, traducción error→HTTP, repositorios, migraciones, CLI, configuración | `domain`, `contracts` | reglas de negocio en rutas o repositorios |
| `apps/web` | Presentación, estado de UI, accesibilidad, preferencia de filtros | `contracts` | importar `api`; reglas de negocio (p. ej., coincidencia de búsqueda) |

Casos de uso del dominio: `createTask`, `updateTask`, `deleteTask`, `restoreTask`,
`listTasks`, `getTask`, `createPerson`, `deletePerson`, `listPeople`, `resolveBoard`,
`regenerateAccessCode`. Cada uno recibe sus puertos por parámetro (inyección explícita, sin
contenedor de dependencias) y devuelve `Result<T, DomainError>`.

## Endpoints de la API

Contrato completo: [contracts/openapi.yaml](./contracts/openapi.yaml). Todas las rutas
`/api/v1/*` exigen `Authorization: Bearer <código>`.

| Método | Ruta | Caso de uso | Requisitos |
|---|---|---|---|
| GET | `/api/health` | — (sin autenticación) | Operación |
| GET | `/api/v1/board` | `resolveBoard` | FR-028a, FR-028c |
| POST | `/api/v1/board/access-code/regenerate` | `regenerateAccessCode` | FR-028b |
| GET | `/api/v1/tasks?assignee=&status=&q=` | `listTasks` (+ recuentos por columna) | FR-001–004, FR-022–026 |
| POST | `/api/v1/tasks` | `createTask` (id del cliente, idempotente) | FR-007–011 |
| GET | `/api/v1/tasks/{id}` | `getTask` | FR-005 |
| PATCH | `/api/v1/tasks/{id}` | `updateTask` (título, descripción, estado, responsable) | FR-013, FR-014, FR-018 |
| DELETE | `/api/v1/tasks/{id}` | `deleteTask` → `undoUntil` | FR-013a |
| POST | `/api/v1/tasks/{id}/restore` | `restoreTask` | FR-013c, FR-013d |
| GET | `/api/v1/people` | `listPeople` (con `assignedTaskCount`) | FR-016 |
| POST | `/api/v1/people` | `createPerson` (id del cliente) | FR-016, FR-016a |
| DELETE | `/api/v1/people/{id}` | `deletePerson` → `unassignedTaskCount` | FR-016b |

## Validación y manejo de errores

**Flujo de una petición**

1. `@fastify/rate-limit` → `429 RATE_LIMITED` con `Retry-After`.
2. Plugin de autenticación: hash del código → tablero; si no existe, `401 INVALID_LINK`
   genérico. El tablero resuelto se adjunta a la petición; ningún caso de uso recibe datos de
   otro tablero.
3. Validación de esquema (Zod, objetos estrictos) de cabeceras, params, query y body →
   `400 VALIDATION_ERROR` con `errors[] = {field, rule, limit}`.
4. Caso de uso: normaliza y aplica invariantes → `DomainError` tipado.
5. Manejador único de errores: `DomainError` → HTTP según la tabla; cualquier otra excepción →
   `500 INTERNAL_ERROR` genérico con `requestId` (la traza solo va al log).
6. Respuesta serializada con su esquema (no se filtran campos internos como `deleted_at` o
   `access_code_hash`).

| Código | HTTP | Mensaje mostrado al usuario (UI) |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Por campo: "El título es obligatorio", "Máximo 200 caracteres"… |
| `INVALID_LINK` | 401 | "Enlace no válido. Pide el enlace actual a tu equipo." |
| `TASK_NOT_FOUND` | 404 | "Esta tarea ya no existe." + recarga del tablero |
| `PERSON_NOT_FOUND` | 404 | "Esta persona ya no está en el equipo." + recarga |
| `ASSIGNEE_NOT_FOUND` | 422 | "La persona elegida ya no está en el equipo." |
| `PERSON_NAME_TAKEN` | 409 | "Ya existe una persona con ese nombre." |
| `ID_CONFLICT` | 409 | "No se pudo guardar. Inténtalo de nuevo." (se regenera el id) |
| `UNDO_EXPIRED` | 410 | "Ya no se puede deshacer." |
| `RATE_LIMITED` | 429 | "Demasiadas acciones seguidas. Espera unos segundos." |
| `SERVICE_UNAVAILABLE` / `INTERNAL_ERROR` / timeout / red | 5xx / — | "No se pudo guardar. Revisa tu conexión." + **Reintentar** |

**En la interfaz**: formularios con mensajes junto al campo (`aria-describedby`,
`aria-invalid`), errores de operación en `role="alert"`, estado "Guardando…" con el control
deshabilitado, sin actualización optimista; lo escrito en formularios se conserva ante
cualquier error (FR-021, FR-021a).

## Decisiones que requieren aprobación

Conforme a la constitución, estas decisiones de arquitectura (**ARQ**) o seguridad (**SEG**)
se explican aquí. **Estado: aprobadas por el usuario el 2026-10-17.** Cualquier cambio
posterior a estas decisiones requiere nueva explicación y aprobación. El detalle y las
alternativas evaluadas están en [research.md](./research.md).

| # | Tipo | Decisión | Por qué | Impacto / riesgo |
|---|---|---|---|---|
| D1 | ARQ | Monorepo npm workspaces con paquetes `domain` y `contracts` separados (R1) | El compilador impide que el dominio dependa de la UI o de la infraestructura | Algo más de configuración inicial (tsconfig por paquete) |
| D2 | ARQ | Hexagonal ligera: casos de uso con puertos e inyección explícita (R2) | El dominio se prueba sin BD ni HTTP | Interfaces adicionales por repositorio |
| D3 | SEG | Código de acceso de 256 bits, guardado como SHA-256, enviado en el fragmento `#k=` y en `Authorization` (R7) | El código no queda en logs, `Referer` ni en la BD en claro | Quien tenga el enlace tiene acceso total (riesgo aceptado en la spec) |
| D4 | SEG | Primer enlace generado por CLI (`board:init`) e impreso una vez; `board:rotate` para recuperación (R7) | Nadie puede "reclamar" el tablero desde la web | Requiere acceso a la consola del servidor para la instalación |
| D5 | SEG | Límites de peticiones por IP, CSP estricta, cuerpo ≤ 16 KiB, sin HTML de usuario (R8) | Mitiga abuso y XSS sin identidad de usuario | Un equipo detrás de una misma IP comparte límites (holgados) |
| D6 | ARQ | Borrado lógico + purga periódica para "Deshacer"; servidor 15 s, UI 10 s (R9) | Deshacer fiable aunque el usuario cierre la página; borrado realmente definitivo | Un proceso periódico en la API (válido con una instancia) |
| D7 | ARQ | `board_id` en todas las tablas aunque v1 tenga un solo tablero | Evita migración de datos al añadir varios tableros o equipos | Una columna y un filtro extra por consulta |
| D8 | ARQ | Filtrado y búsqueda en el servidor con `unaccent` (R12) | Una sola implementación de la regla; la UI no contiene lógica de negocio | Una petición por cambio de filtro (con *debounce* de 300 ms en la búsqueda) |
| D9 | ARQ | Ids generados por el cliente para creaciones idempotentes (R10) | Reintentos tras timeout sin duplicados (FR-011) | El servidor debe rechazar ids repetidos con datos distintos |
| D10 | ARQ | Arrastrar y soltar con `@dnd-kit/core`, solo con las tres columnas visibles (≥ 768 px), reutilizando la mutación de cambio de estado (R13, FR-019a) | Única opción mantenida que trae soporte de táctil, teclado y anuncios accesibles; no añade lógica de negocio a la UI | Nueva dependencia de frontend (~10 KB gzip); en móvil en pestañas solo existe el control explícito |

**Fuera de alcance de este plan (anotado para el despliegue)**: copias de seguridad
(`pg_dump` diario, 7 días), HTTPS y alojamiento. Necesarios antes de un uso real con datos
del equipo.

## Project Structure

### Documentation (this feature)

```text
specs/001-kanban-task-board/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: entidades, tablas, transiciones, migraciones
├── quickstart.md        # Fase 1: guía de arranque y validación
├── contracts/
│   └── openapi.yaml     # Fase 1: contrato de la API REST
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
package.json                 # npm workspaces + scripts raíz (test, lint, test:e2e)
.nvmrc                       # Node 24
README.md                    # propósito, arranque y notas de seguridad
tsconfig.base.json
eslint.config.js             # incluye react/no-danger y jsx-a11y
.prettierrc.json
.dependency-cruiser.cjs      # reglas de límites entre paquetes
.github/workflows/ci.yml     # lint, límites, tipos, pruebas, npm audit
docker-compose.yml           # db, db-test, migrate, api, web
.env.example                 # valores ficticios; .env en .gitignore

packages/
├── domain/
│   ├── src/
│   │   ├── shared/          # Result, DomainError, normalización de texto, Clock
│   │   ├── board/           # Board, AccessCode, BoardRepository (puerto)
│   │   ├── people/          # Person, PersonName, PersonRepository (puerto)
│   │   ├── tasks/           # Task, TaskTitle, TaskDescription, TaskStatus, TaskQuery, TaskRepository (puerto)
│   │   ├── use-cases/       # createTask, updateTask, deleteTask, restoreTask, listTasks, …
│   │   └── index.ts         # API pública del paquete
│   └── tests/
│       ├── support/         # repositorios en memoria, reloj falso
│       └── unit/            # un archivo por caso de uso y objeto valor
└── contracts/
    ├── src/
    │   ├── tasks.ts         # esquemas Zod de tareas y query
    │   ├── people.ts
    │   ├── board.ts
    │   ├── problem.ts       # Problem Details + códigos de error
    │   └── index.ts
    └── tests/

apps/
├── api/
│   ├── src/
│   │   ├── config/env.ts            # variables de entorno validadas
│   │   ├── http/
│   │   │   ├── app.ts               # construcción de la app (usada por main y tests)
│   │   │   ├── plugins/             # auth, error-handler, security (helmet, rate-limit)
│   │   │   └── routes/              # health, board, tasks, people
│   │   ├── persistence/
│   │   │   ├── db.ts                # Kysely + tipos de tablas
│   │   │   ├── migrations/          # 0001_extensions … 0004_task
│   │   │   └── repositories/        # implementaciones de los puertos
│   │   ├── security/access-code.ts  # generación y hash del código de acceso
│   │   ├── jobs/purge-deleted-tasks.ts
│   │   ├── cli/                     # board-init, board-rotate, migrate
│   │   └── main.ts
│   ├── tests/
│   │   ├── integration/             # rutas con app.inject() + PostgreSQL de pruebas
│   │   ├── contract/                # respuestas validadas contra openapi.yaml
│   │   └── migrations/              # up/down de cada migración
│   └── Dockerfile
└── web/
    ├── src/
    │   ├── app/                     # App, proveedores, lectura del código del fragmento
    │   ├── api/                     # cliente HTTP (timeout 10 s, Authorization) y hooks Query
    │   ├── features/
    │   │   ├── board/               # tablero, columnas, pestañas móviles, contadores, arrastrar y soltar
    │   │   ├── tasks/               # tarjeta, formulario, detalle/edición, borrar + deshacer
    │   │   ├── people/              # diálogo de gestión de personas
    │   │   ├── filters/             # búsqueda y filtros (persistidos en localStorage)
    │   │   └── access/              # enlace no válido, regenerar y copiar enlace
    │   ├── ui/                      # primitivas accesibles: Dialog, Toast, LiveRegion, Button
    │   ├── i18n/es.ts               # textos y mapeo de códigos de error
    │   └── main.tsx
    ├── tests/                       # componentes con Testing Library + vitest-axe
    └── Dockerfile

e2e/
├── tests/                           # recorridos US1–US6, escritorio y 320 px, axe
└── playwright.config.ts
```

**Structure Decision**: aplicación web en monorepo con dos aplicaciones (`apps/api`,
`apps/web`) y dos paquetes compartidos (`packages/domain`, `packages/contracts`). La
separación en paquetes materializa los Principios I y II; la estructura de `features/` en el
frontend y de `board/people/tasks` en el dominio sigue las capacidades de la spec.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
