# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

TaskFlow (tablero kanban compartido para equipos pequeños) está en fase de diseño: todavía **no
hay código de aplicación**. Lo que existe es la documentación de Spec Kit de la feature
`001-kanban-task-board` (rama del mismo nombre). La implementación sigue
`specs/001-kanban-task-board/tasks.md` (T001–T134, organizadas por historia de usuario, pruebas
primero). Los comandos y rutas de abajo son los definidos en el plan; verifica que existen
antes de usarlos y actualiza este archivo cuando cambien.

Idioma: la documentación, los textos de la UI y los mensajes de commit están en español.

## Flujo de trabajo (Spec Kit)

Fuente de verdad, en orden de autoridad:

1. `.specify/memory/constitution.md` — reglas no negociables. Las más operativas:
   - No declarar una tarea terminada si sus pruebas fallan o no se ejecutaron.
   - Toda decisión que afecte a la arquitectura o a la seguridad se **explica y se espera
     aprobación del usuario antes de aplicarla**. Las decisiones D1–D10 de `plan.md` ya están
     aprobadas (2026-10-17); cualquier decisión nueva o desviación requiere aprobación.
   - Cambios de esquema solo mediante migraciones versionadas con `up`/`down`.
2. `specs/001-kanban-task-board/spec.md` — requisitos (FR-###, SC-###) y clarificaciones.
3. `plan.md`, `research.md` (decisiones R1–R17 con alternativas), `data-model.md`,
   `contracts/openapi.yaml` (contrato de la API; las pruebas de contrato lo cargan desde esta
   ruta), `quickstart.md` (validación manual).
4. `tasks.md` — marcar `[x]` solo cuando la tarea y sus pruebas pasan.

Comandos de Spec Kit disponibles como skills: `/speckit-specify`, `/speckit-clarify`,
`/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`,
`/speckit-checklist`, `/speckit-converge`. Los scripts que usan están en `.specify/scripts/bash/`.
`.specify/feature.json` es estado local (ignorado por git).

## Arquitectura planificada

Monorepo npm workspaces, TypeScript estricto, Node 24:

```text
apps/web (React 19 + Vite) ──▶ packages/contracts (Zod) ──▶ packages/domain (TS puro)
apps/api (Fastify 5)       ──▶ contracts + domain; repositorios Kysely ──▶ PostgreSQL 17
```

- **`packages/domain`**: entidades, objetos valor, casos de uso y *puertos* (interfaces de
  repositorio, `Clock`, `AccessCodeService`). Sin E/S ni dependencias de runtime. Los casos de
  uso reciben los puertos por parámetro y devuelven `Result<T, DomainError>` (no lanzan).
  Los límites (`TITLE_MAX = 200`, `UNDO_WINDOW_SERVER_MS`, …) viven en `shared/limits.ts` y
  `contracts` los reutiliza.
- **`packages/contracts`**: esquemas Zod de petición/respuesta y errores, compartidos por API y
  web. Deben coincidir con `contracts/openapi.yaml`.
- **`apps/api`**: rutas HTTP (adaptadores de entrada), repositorios Kysely (adaptadores de
  salida), migraciones, CLI y configuración. Sin reglas de negocio en rutas ni repositorios.
- **`apps/web`**: solo presentación; importa `contracts`, nunca `apps/api`. Sin lógica de
  negocio (p. ej., la coincidencia de búsqueda sin tildes se hace en el servidor).
- Los límites se verifican con `dependency-cruiser` (`npm run lint:deps`).

Comportamientos transversales que no se deducen de un solo archivo:

- **Acceso sin login**: enlace secreto `/#k=<código>` (256 bits, base64url). El código va en el
  fragmento para que nunca llegue a logs ni a `Referer`; la web lo envía como
  `Authorization: Bearer`. En BD solo se guarda su SHA-256. Cualquier código inválido produce
  el mismo `401 INVALID_LINK`. El código nunca debe aparecer en errores, logs ni cabeceras.
  El primer enlace lo imprime `board:init` por consola.
- **Escrituras pesimistas**: la UI solo refleja un cambio cuando el servidor lo confirma
  (estado "Guardando…", sin actualización optimista), con timeout de cliente de 10 s.
- **Idempotencia**: el cliente genera el UUID de tareas y personas; un `POST` repetido con los
  mismos datos devuelve 200 con la entidad existente, con datos distintos `409 ID_CONFLICT`.
- **Deshacer borrado**: borrado lógico (`deleted_at`); la UI ofrece "Deshacer" 10 s, el servidor
  acepta 15 s y una purga periódica elimina físicamente. Todas las marcas de tiempo salen del
  `Clock` del dominio (nunca `now()` en SQL) para que las pruebas sean deterministas.
- **Errores**: `application/problem+json` (RFC 9457) con `code` estable; la web traduce `code` a
  mensajes en español (`apps/web/src/i18n/es.ts`).
- **Concurrencia**: gana el último guardado; operar sobre una tarea borrada da
  `404 TASK_NOT_FOUND` y la web recarga el tablero.
- `board_id` existe en todas las tablas aunque v1 tenga un único tablero.

## Comandos (definidos en el plan)

```bash
cp .env.example .env && npm ci
docker compose up --build              # db, migrate (migraciones + board:init), api :3000, web :5173
docker compose up -d db-test           # PostgreSQL de pruebas (puerto 5433), necesario para npm test

npm test                               # dominio + contracts + API + web
npm test -w packages/domain            # un solo paquete
npx vitest run <ruta/al/archivo.test.ts> -w apps/api   # un solo archivo
npx vitest run -t "<nombre del test>" -w packages/domain
npm run test:e2e                       # Playwright (proyectos desktop y mobile-320, con axe)
npm run lint && npm run lint:deps && npm run typecheck

npm run db:migrate -w apps/api         # aplicar migraciones
npm run db:migrate:down -w apps/api    # revertir una
npm run board:rotate -w apps/api       # regenerar el enlace si se pierde
```

Las pruebas de `apps/api` usan una PostgreSQL real compartida (`TEST_DATABASE_URL`) y se
ejecutan con `fileParallelism: false`; no las paralelices entre archivos.
