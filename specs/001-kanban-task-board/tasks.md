---

description: "Lista de tareas para implementar TaskFlow v1 (tablero kanban)"
---

# Tasks: Tablero Kanban de Tareas (TaskFlow v1)

**Input**: Design documents from `/specs/001-kanban-task-board/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml,
quickstart.md

**Tests**: INCLUIDAS. El usuario pidió pruebas automatizadas de la lógica de negocio y la API,
y la constitución (Principio IV, no negociable) exige pruebas de las operaciones importantes.
Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Gate**: decisiones D1–D10 de `plan.md` aprobadas por el usuario el 2026-10-17. Cualquier
nueva decisión de arquitectura o seguridad que surja durante la implementación debe explicarse
y aprobarse antes de aplicarse (constitución).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (ver `plan.md` → Project Structure): `packages/domain/`, `packages/contracts/`,
`apps/api/`, `apps/web/`, `e2e/`. Contrato de referencia:
`specs/001-kanban-task-board/contracts/openapi.yaml`.

**Orden de historias**: US1 (P1) → US2 (P2) → US6 (P3) → US3 (P3) → US4 (P4) → US5 (P5).
US6 va antes que US3 porque la asignación necesita personas.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el monorepo, las herramientas y el entorno local reproducible.

- [X] T001 Create root `package.json` with npm workspaces `["packages/*", "apps/*", "e2e"]`, `"engines": {"node": ">=24"}`, `"type": "module"` and scripts `test` (domain + contracts + api + web), `test:e2e`, `lint`, `lint:deps`, `typecheck`, `format`; add `.nvmrc` with `24`
- [X] T002 Create `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: ES2023`, `module: ESNext`, `moduleResolution: Bundler`, `noEmit: true` (implemented: packages export TypeScript sources, the API runs with `tsx` and the web with Vite; `NodeNext` + project references were not needed)
- [X] T003 [P] Create `.gitignore` (node_modules, dist, coverage, .env, playwright-report, test-results) and `.env.example` with fictitious values only: `POSTGRES_USER=taskflow`, `POSTGRES_PASSWORD=change-me`, `POSTGRES_DB=taskflow`, `DATABASE_URL`, `TEST_DATABASE_URL` (port 5433), `API_PORT=3000`, `PUBLIC_WEB_URL=http://localhost:5173`, `LOG_LEVEL=info`
- [X] T004 [P] Create package `@taskflow/domain` in `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts` with NO runtime dependencies (only devDependencies `vitest`, `typescript`)
- [X] T005 [P] Create package `@taskflow/contracts` in `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/vitest.config.ts` with dependencies `zod` and `@taskflow/domain` only
- [X] T006 [P] Create package `@taskflow/api` in `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts` with dependencies `fastify@5`, `fastify-type-provider-zod`, `zod`, `kysely`, `pg`, `@fastify/helmet`, `@fastify/rate-limit`, `@taskflow/domain`, `@taskflow/contracts`; devDependencies `vitest`, `tsx`, `ajv`, `ajv-formats`, `yaml`, `@types/pg`; scripts `dev`, `build`, `start`, `db:migrate`, `db:migrate:down`, `board:init`, `board:rotate`
- [X] T007 [P] Create package `@taskflow/web` with Vite + React 19 + TypeScript in `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html` (`lang="es"`); dependencies `react@19`, `react-dom@19`, `@tanstack/react-query`, `@dnd-kit/core`, `@taskflow/contracts`; devDependencies `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `axe-core` (implemented instead of `vitest-axe`, unmaintained since 2022; helper in `apps/web/tests/axe.ts`)
- [X] T008 [P] Create package `e2e` in `e2e/package.json` and `e2e/playwright.config.ts` with `@playwright/test` and `@axe-core/playwright`; projects `desktop` (1280×800) and `mobile-320` (320×640, `hasTouch: true`); `baseURL` from `E2E_BASE_URL` (default `http://localhost:5173`)
- [X] T009 [P] Configure ESLint flat config in `eslint.config.js` (typescript-eslint, react-hooks, jsx-a11y; rule `react/no-danger: error` to enforce FR-010) and Prettier in `.prettierrc.json`
- [X] T010 [P] Configure module boundaries in `.dependency-cruiser.cjs`: `packages/domain` may not import any package or Node built-in I/O module (`fs`, `net`, `http`, `crypto`); `packages/contracts` may import only `@taskflow/domain` and `zod`; `apps/web` may not import `apps/api`, `pg`, `kysely` or `fastify`; no circular dependencies; wire it to `npm run lint:deps`
- [X] T011 Create `docker-compose.yml` with services `db` (`postgres:17-alpine`, named volume, healthcheck `pg_isready`), `db-test` (`postgres:17-alpine`, `tmpfs: /var/lib/postgresql/data`, port 5433), `migrate` (runs `npm run db:migrate -w apps/api && npm run board:init -w apps/api`, then exits), `api` (depends on `migrate` completed successfully, port 3000), `web` (Vite dev server port 5173, env `API_PROXY_TARGET=http://api:3000`); all credentials read from `.env`
- [X] T012 [P] Create `apps/api/Dockerfile` and `apps/web/Dockerfile` based on `node:24-alpine`, installing with `npm ci` from the workspace root
- [X] T013 [P] Create CI workflow in `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run lint:deps`, `npm run typecheck`, `npm test` (with a `postgres:17-alpine` service as `TEST_DATABASE_URL`) and `npm audit --audit-level=high`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo de dominio compartido, esquema de BD completo, acceso por enlace secreto,
manejo de errores y cliente HTTP. Toda historia depende de esta fase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Dominio compartido

- [X] T014 [P] Write unit tests for text normalization in `packages/domain/tests/unit/shared/text.test.ts`: `normalizeText` trims and applies Unicode NFC; `charLength` counts code points (`"😀"` → 1, `"é"` composed/decomposed → 1 after NFC)
- [X] T015 [P] Implement `Result<T, E>` with `ok()`, `err()`, `isOk()` in `packages/domain/src/shared/result.ts`
- [X] T016 [P] Implement `DomainError` discriminated union in `packages/domain/src/shared/errors.ts` with codes `VALIDATION_ERROR` (`issues: {field, rule: 'required'|'too_short'|'too_long'|'invalid_value'|'invalid_format'|'unknown_field', limit?}[]`), `TASK_NOT_FOUND`, `PERSON_NOT_FOUND`, `ASSIGNEE_NOT_FOUND`, `PERSON_NAME_TAKEN`, `ID_CONFLICT`, `UNDO_EXPIRED`
- [X] T017 [P] Implement limits in `packages/domain/src/shared/limits.ts`: `TITLE_MIN = 1`, `TITLE_MAX = 200`, `DESCRIPTION_MAX = 5000`, `PERSON_NAME_MIN = 1`, `PERSON_NAME_MAX = 50`, `SEARCH_MAX = 100`, `UNDO_WINDOW_UI_MS = 10_000`, `UNDO_WINDOW_SERVER_MS = 15_000`, `CLIENT_TIMEOUT_MS = 10_000`
- [X] T018 Implement `normalizeText` and `charLength` in `packages/domain/src/shared/text.ts` so T014 passes
- [X] T019 [P] Implement `Clock` port (`now(): Date`) in `packages/domain/src/shared/clock.ts`

### Tablero y acceso (dominio)

- [X] T020 [P] Write unit tests in `packages/domain/tests/unit/use-cases/board.test.ts`: `initBoard` creates a board only if none exists and returns the code once; `resolveBoard` returns the board for a valid code and `null` for any invalid code; `regenerateAccessCode` replaces the hash so the old code no longer resolves
- [X] T021 Implement `Board` entity (`id`, `accessCodeHash`, `accessCodeRotatedAt`, `createdAt`), `BoardRepository` port (`findByAccessCodeHash`, `findAny`, `insert`, `updateAccessCodeHash`) and `AccessCodeService` port (`generate(): string`, `hash(code): Uint8Array`) in `packages/domain/src/board/board.ts`
- [X] T022 Implement use cases `initBoard`, `resolveBoard`, `regenerateAccessCode` in `packages/domain/src/use-cases/board.ts` (ports passed as parameters, returning `Result`)
- [X] T023 Create in-memory test doubles `InMemoryBoardRepository`, `FakeClock`, `FakeAccessCodeService` in `packages/domain/tests/support/in-memory.ts` so T020 passes
- [X] T024 Export the public API of the domain package in `packages/domain/src/index.ts`

### Contratos compartidos

- [X] T025 [P] Implement `ProblemSchema`, `ErrorCode` enum (`VALIDATION_ERROR`, `INVALID_LINK`, `TASK_NOT_FOUND`, `PERSON_NOT_FOUND`, `ASSIGNEE_NOT_FOUND`, `PERSON_NAME_TAKEN`, `ID_CONFLICT`, `UNDO_EXPIRED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`) and `ValidationIssueSchema` in `packages/contracts/src/problem.ts`, matching `components.schemas.Problem` of the OpenAPI contract
- [X] T026 [P] Implement `BoardSchema` and `RegenerateAccessCodeResponseSchema` (`accessCode` matching `^[A-Za-z0-9_-]{43}$`, `rotatedAt` ISO date-time) in `packages/contracts/src/board.ts`; export everything from `packages/contracts/src/index.ts`

### Persistencia

- [X] T027 Implement environment config in `apps/api/src/config/env.ts`: Zod schema for `DATABASE_URL`, `API_PORT`, `PUBLIC_WEB_URL`, `LOG_LEVEL`; process exits with a clear message (without printing values) if invalid
- [X] T028 Implement Kysely instance and `Database` table types (`board`, `person`, `task`) in `apps/api/src/persistence/db.ts`
- [X] T029 [P] Create migration `apps/api/src/persistence/migrations/0001_extensions.ts`: `up` = `CREATE EXTENSION IF NOT EXISTS unaccent`; `down` = `DROP EXTENSION IF EXISTS unaccent`
- [X] T030 [P] Create migration `apps/api/src/persistence/migrations/0002_board.ts`: table `board` with `id uuid PK`, `access_code_hash bytea NOT NULL UNIQUE`, `access_code_rotated_at timestamptz NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`; `down` drops it
- [X] T031 [P] Create migration `apps/api/src/persistence/migrations/0003_person.ts`: table `person` with `id uuid PK`, `board_id uuid NOT NULL FK → board(id) ON DELETE CASCADE`, `name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50)`, `created_at timestamptz NOT NULL DEFAULT now()`; unique index `UNIQUE (board_id, lower(name))`; `down` drops it
- [X] T032 [P] Create migration `apps/api/src/persistence/migrations/0004_task.ts`: enum `task_status` (`'pending'`, `'in_progress'`, `'done'`); table `task` with `id uuid PK`, `board_id uuid NOT NULL FK → board(id) ON DELETE CASCADE`, `title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)`, `description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000)`, `status task_status NOT NULL DEFAULT 'pending'`, `assignee_id uuid NULL FK → person(id) ON DELETE SET NULL`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz NULL`; partial indexes `(board_id, created_at DESC) WHERE deleted_at IS NULL`, `(assignee_id) WHERE deleted_at IS NULL`, `(deleted_at) WHERE deleted_at IS NOT NULL`; `down` drops table and type
- [X] T033 Implement migration CLI in `apps/api/src/cli/migrate.ts` using Kysely `Migrator` with a static provider in `apps/api/src/persistence/migrations/index.ts` (implemented instead of `FileMigrationProvider` so migrations load the same way in the CLI, tests and containers), supporting `up` (latest) and `down` (one step), exit code ≠ 0 on failure
- [X] T034 Create test support in `apps/api/tests/support/test-db.ts` (connects to `TEST_DATABASE_URL`, migrates to latest once, truncates `task`, `person`, `board` before each test file) and `apps/api/tests/support/test-app.ts` (builds the app with real repositories, creates a board and returns its access code and an `authHeader` helper; `buildTestApp({ clock })` accepts a `FakeClock` that is passed to all use cases and the purge job); configure `apps/api/vitest.config.ts` with `fileParallelism: false` so files sharing the test database never run concurrently
- [X] T035 Write migration tests in `apps/api/tests/migrations/migrations.test.ts`: migrate to latest, then `down` step by step to zero and `up` again without errors; assert CHECK constraints reject a 201-character title and a 51-character person name
- [X] T036 Implement `KyselyBoardRepository` (implements `BoardRepository`) in `apps/api/src/persistence/repositories/board-repository.ts`
- [X] T037 Implement `NodeAccessCodeService` in `apps/api/src/security/access-code.ts`: `generate()` = `crypto.randomBytes(32).toString('base64url')` (43 chars, 256 bits); `hash()` = SHA-256
- [X] T038 Implement CLIs `apps/api/src/cli/board-init.ts` (creates the board if none exists and prints `Enlace del tablero: ${PUBLIC_WEB_URL}/#k=<code>` exactly once; otherwise prints "El tablero ya existe" without any code) and `apps/api/src/cli/board-rotate.ts` (regenerates and prints the new link)

### HTTP base

- [X] T039 [P] Write integration tests in `apps/api/tests/integration/access.test.ts`: `GET /api/health` → 200 `{status:"ok"}` without auth; `GET /api/v1/board` with missing header, malformed header, wrong code and a code from a deleted board all return byte-identical `401` bodies with `code: "INVALID_LINK"` and `title: "Enlace no válido"`; valid code → 200 `Board`; responses include `Content-Security-Policy` with `default-src 'self'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`; unknown route → 404 `NOT_FOUND`; DB down → `/api/health` 503 (the body > 16 KiB → 413 check moved to T056, first phase with a POST route); unexpected error → 500 `INTERNAL_ERROR` with `requestId` and no stack trace; no error response body (400, 401, 404, 429, 500) contains the access code sent in the request
- [X] T040 [P] Write OpenAPI contract helper in `apps/api/tests/contract/openapi.ts` that loads `specs/001-kanban-task-board/contracts/openapi.yaml` with `yaml`, compiles response schemas with `ajv` (draft 2020-12) + `ajv-formats`, and exposes `expectMatchesContract(operationId, status, body)`
- [X] T041 Implement error handler plugin in `apps/api/src/http/plugins/error-handler.ts`: responds `application/problem+json`; maps Zod/Fastify validation errors to `400 VALIDATION_ERROR` with `errors[] {field, rule, limit}`; maps `DomainError` codes to HTTP (`TASK_NOT_FOUND`/`PERSON_NOT_FOUND` 404, `ASSIGNEE_NOT_FOUND` 422, `PERSON_NAME_TAKEN`/`ID_CONFLICT` 409, `UNDO_EXPIRED` 410); any other error → `500 INTERNAL_ERROR` with generic Spanish `title` and `requestId`, stack only in logs
- [X] T042 Implement auth plugin in `apps/api/src/http/plugins/auth.ts`: for every `/api/v1/*` route read `Authorization: Bearer <code>`, call `resolveBoard`, decorate `request.board`; on failure reply the single generic `401 INVALID_LINK` problem (FR-028c)
- [X] T043 Implement security plugin in `apps/api/src/http/plugins/security.ts`: `@fastify/helmet` (CSP `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`), `@fastify/rate-limit` (300 req/min per IP overall, 60 write req/min per IP, 20 `401` responses/min per IP) replying `429 RATE_LIMITED` with `Retry-After`
- [X] T044 Implement `buildApp(deps)` in `apps/api/src/http/app.ts`: Fastify with `fastify-type-provider-zod` validator/serializer, `bodyLimit: 16384`, `genReqId` (UUID), pino logger with `redact: ['req.headers.authorization']`, registers plugins and routes
- [X] T045 Implement routes `GET /api/health` (checks DB with `SELECT 1`, 503 `SERVICE_UNAVAILABLE` if down) in `apps/api/src/http/routes/health.ts` and `GET /api/v1/board` in `apps/api/src/http/routes/board.ts`; then T039 must pass
- [X] T046 Implement entry point `apps/api/src/main.ts` (loads env, builds app, listens on `API_PORT`, graceful shutdown on SIGTERM)

### Web base

- [X] T047 [P] Write tests in `apps/web/tests/api/client.test.ts`: sends `Authorization: Bearer <code>`; aborts after 10 s and throws `ApiError{code:'TIMEOUT'}`; network failure → `ApiError{code:'NETWORK'}`; parses `application/problem+json` into `ApiError` with `code` and `errors[]`; rejects responses that do not match the expected Zod schema
- [X] T048 [P] Implement access code reader in `apps/web/src/app/access-code.ts`: reads `k` from `location.hash` (`#k=<code>`), keeps it in memory only, never logs it; exposes `getAccessCode()` and `setAccessCode(code)` (updates the hash with `history.replaceState`)
- [X] T049 Implement HTTP client in `apps/web/src/api/client.ts` (base `/api`, `AbortController` with `CLIENT_TIMEOUT_MS`, response validation with `@taskflow/contracts`) so T047 passes
- [X] T050 [P] Implement Spanish texts in `apps/web/src/i18n/es.ts`: column labels (Pendiente, En progreso, Hecha), and error-code messages exactly as in `plan.md` → "Validación y manejo de errores" table (e.g. `INVALID_LINK` → "Enlace no válido. Pide el enlace actual a tu equipo.", `TIMEOUT`/`NETWORK`/5xx → "No se pudo guardar. Revisa tu conexión.")
- [X] T051 [P] Implement accessible UI primitives in `apps/web/src/ui/`: `Button.tsx` (min 44×44 px, visible focus), `Dialog.tsx` (native `<dialog>`, focus trap, Escape closes, returns focus), `LiveRegion.tsx` (`aria-live="polite"` + `announce()` hook), `ErrorAlert.tsx` (`role="alert"`, optional "Reintentar" button), `Toast.tsx`; design tokens with WCAG AA contrast in `apps/web/src/ui/tokens.css`
- [X] T052 Implement invalid link page in `apps/web/src/features/access/InvalidLinkPage.tsx` (generic "Enlace no válido" message, no other data) shown when no code is present or any request returns `INVALID_LINK`
- [X] T053 Implement app shell in `apps/web/src/app/App.tsx` and `apps/web/src/main.tsx` (QueryClientProvider with retries disabled for mutations, LiveRegion provider, header with app name) and Vite proxy `/api` → `process.env.API_PROXY_TARGET ?? 'http://localhost:3000'` in `apps/web/vite.config.ts`

**Checkpoint**: `docker compose up` arranca, imprime el enlace, `/api/health` responde y la web
muestra "Enlace no válido" sin código. `npm test` en verde.

---

## Phase 3: User Story 1 - Ver el tablero y crear tareas (Priority: P1) 🎯 MVP

**Goal**: Tablero con tres columnas; crear tareas con título y descripción que persisten y
aparecen en Pendiente; ver el detalle de una tarea.

**Independent Test**: abrir el tablero vacío, crear dos tareas, comprobar que aparecen en
Pendiente (la más reciente arriba) con su título y que siguen ahí al recargar.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T054 [P] [US1] Write domain tests in `packages/domain/tests/unit/use-cases/create-task.test.ts`: title trimmed and NFC-normalized; `"   "` → `VALIDATION_ERROR {field:'title', rule:'too_short', limit:1}`; 200 chars OK, 201 → `too_long` limit 200; emoji counts as 1 char; description optional (`''`), 5000 OK, 5001 → `too_long`; new task status is `pending`; same `id` + same data → returns existing task flagged as replay; same `id` + different data → `ID_CONFLICT`
- [X] T055 [P] [US1] Write domain tests in `packages/domain/tests/unit/use-cases/list-tasks.test.ts`: `listTasks` returns non-deleted tasks of the board ordered by `createdAt` descending with `counts {pending, in_progress, done}`; `getTask` returns `TASK_NOT_FOUND` for unknown id or other board
- [X] T056 [P] [US1] Write API tests in `apps/api/tests/integration/tasks-create.test.ts`: `POST /api/v1/tasks` → 201; repeat same body → 200 same task (one row in DB); same id different title → 409 `ID_CONFLICT`; `title: "   "` → 400 with `errors[0] {field:'title', rule:'too_short'}`; unknown field → 400 `unknown_field`; body > 16 KiB → 413 `VALIDATION_ERROR`; `<script>alert(1)</script>` title stored and returned literally; `GET /api/v1/tasks` order and counts; `GET /api/v1/tasks/{id}` 200 and 404
- [X] T057 [P] [US1] Write contract tests in `apps/api/tests/contract/tasks.contract.test.ts` validating `createTask` (201, 200, 400, 409), `listTasks` (200) and `getTask` (200, 404) responses with `expectMatchesContract`
- [X] T058 [P] [US1] Write component tests in `apps/web/tests/board/board.test.tsx`: empty board shows three columns in order Pendiente, En progreso, Hecha with count 0 and guidance message; create form shows "El título es obligatorio" next to the field for blank title without sending a request; form keeps typed values after a failed save; shows "Guardando…" and disables submit while pending; no axe violations
- [X] T059 [P] [US1] Write E2E test in `e2e/tests/us1-board-create.spec.ts` (projects desktop and mobile-320): empty state, create "Preparar demo" with description, appears in Pendiente, persists after reload, detail dialog shows title, description, status, "Sin asignar" and creation date; axe scan has no violations

### Implementation for User Story 1

- [X] T060 [P] [US1] Implement `TaskStatus` (`'pending' | 'in_progress' | 'done'`, ordered list `TASK_STATUSES`), `TaskTitle` (1–200 chars after normalization), `TaskDescription` (≤ 5000 chars) and `Task` entity (`id`, `boardId`, `title`, `description`, `status`, `assigneeId | null`, `createdAt`, `updatedAt`) in `packages/domain/src/tasks/task.ts`
- [X] T061 [US1] Define `TaskRepository` port in `packages/domain/src/tasks/task-repository.ts` with `insert`, `findById(boardId, id)` (excludes deleted), `list(boardId, criteria)` returning tasks ordered by `createdAt` desc, and `countByStatus`; criteria type `TaskCriteria` with optional `assignee`, `statuses`, `text` (used later by US4)
- [X] T062 [US1] Implement use cases `createTask`, `listTasks`, `getTask` in `packages/domain/src/use-cases/tasks.ts` and add `InMemoryTaskRepository` to `packages/domain/tests/support/in-memory.ts` so T054–T055 pass
- [X] T063 [P] [US1] Implement `TaskSchema`, `CreateTaskRequestSchema` (strict; `id` uuid, `title` string max 200, `description` max 5000 default `''`, `assigneeId` uuid | null optional), `ListTasksResponseSchema` (`items`, `counts`) and `GetTaskParamsSchema` in `packages/contracts/src/tasks.ts`, reusing limits from `@taskflow/domain`
- [X] T064 [US1] Implement `KyselyTaskRepository` (insert, findById, list with `WHERE deleted_at IS NULL ORDER BY created_at DESC`, counts by status, left join `person` to return `assignee {id, name} | null`) in `apps/api/src/persistence/repositories/task-repository.ts`
- [X] T065 [US1] Implement routes `POST /api/v1/tasks` (201 new / 200 replay), `GET /api/v1/tasks`, `GET /api/v1/tasks/:taskId` in `apps/api/src/http/routes/tasks.ts` and register them in `apps/api/src/http/app.ts`; T056–T057 must pass
- [X] T066 [P] [US1] Implement query hooks `useTasks()` and `useCreateTask()` (pessimistic: invalidate `['tasks']` on success, no optimistic update; reuse the same `crypto.randomUUID()` id when retrying the same submission; on `ID_CONFLICT` generate a new id for the next submission and show "No se pudo guardar. Inténtalo de nuevo.") in `apps/web/src/api/tasks.ts`
- [X] T067 [P] [US1] Implement `TaskCard` in `apps/web/src/features/tasks/TaskCard.tsx` (title as button opening detail; assignee name or "Sin asignar" with icon + text; text rendered as plain text)
- [X] T068 [US1] Implement `Board` in `apps/web/src/features/board/Board.tsx`, `Column.tsx` and `BoardTabs.tsx`: three columns in order with visible-task count and empty-column message; ≥ 768 px three columns side by side, < 768 px accessible tabs (`role="tablist"`, arrow-key navigation, count in each tab); no horizontal page scroll at 320 px; columns scroll vertically
- [X] T069 [US1] Implement `CreateTaskForm` in `apps/web/src/features/tasks/CreateTaskForm.tsx`: labelled title (required, `maxLength` 200, live counter) and description (`maxLength` 5000) fields; client-side check with contract schema; field errors via `aria-invalid` + `aria-describedby`; "Guardando…" + disabled submit while pending; on success clears form and announces "Tarea creada"; on error keeps values and shows `ErrorAlert` with "Reintentar"
- [X] T070 [US1] Implement `TaskDetailDialog` in `apps/web/src/features/tasks/TaskDetailDialog.tsx` showing title, full description (preserving line breaks as text), status label, assignee or "Sin asignar", and creation date formatted with `Intl.DateTimeFormat('es-ES')`; `TASK_NOT_FOUND` → message "Esta tarea ya no existe." and board refetch
- [X] T071 [US1] Compose board page in `apps/web/src/app/App.tsx` (header + `CreateTaskForm` + `Board` + empty-board guidance); T058–T059 must pass

**Checkpoint**: MVP funcional — tablero, creación y detalle, probados de forma independiente.

---

## Phase 4: User Story 2 - Cambiar el estado de una tarea (Priority: P2)

**Goal**: Mover tareas entre cualquier par de estados con un control explícito (ratón, teclado,
táctil) y, con las tres columnas visibles, arrastrando la tarjeta; guardado pesimista.

**Independent Test**: crear una tarea, pasarla a En progreso y a Hecha solo con teclado
(selector y arrastre por teclado) y comprobar que persiste tras recargar.

### Tests for User Story 2 ⚠️

- [X] T072 [P] [US2] Write domain tests in `packages/domain/tests/unit/use-cases/update-task-status.test.ts`: every transition between the 3 states allowed (with and without assignee); same status is a no-op that does not change `updatedAt`; invalid status → `VALIDATION_ERROR {field:'status', rule:'invalid_value'}`; unknown/deleted task → `TASK_NOT_FOUND`
- [X] T073 [P] [US2] Write API tests in `apps/api/tests/integration/tasks-status.test.ts`: `PATCH /api/v1/tasks/{id}` `{status:'done'}` → 200 and listed under done; `{status:'archived'}` → 400; `{}` → 400 (minProperties 1); unknown id → 404 `TASK_NOT_FOUND`; contract validation of `updateTask` responses
- [X] T074 [P] [US2] Write component tests in `apps/web/tests/tasks/status-change.test.tsx`: status `<select>` labelled "Estado de «<título>»"; while saving the card shows "Guardando…" and select/drag are disabled; on failure the card stays in its column and `ErrorAlert` with "Reintentar" appears; on success the new status is announced; no axe violations
- [X] T075 [P] [US2] Write component tests in `apps/web/tests/board/drag-and-drop.test.tsx`: keyboard drag (Space, ArrowRight, Space) triggers a status update and announcements "Tarea cogida", "Sobre En progreso", "Tarea soltada en En progreso"; Escape cancels without request; drop on same column sends no request; drag disabled below 768 px
- [X] T076 [P] [US2] Write E2E test in `e2e/tests/us2-status.spec.ts`: change status with select (desktop + mobile-320), mouse drag from Pendiente to Hecha (desktop), keyboard drag, and save failure simulated with `page.route('**/api/v1/tasks/*', r => r.abort())` → card does not move, error with "Reintentar", retry succeeds once restored

### Implementation for User Story 2

- [X] T077 [US2] Implement `updateTask` use case in `packages/domain/src/use-cases/tasks.ts` supporting the `status` field (any transition; same value no-op; sets `updatedAt` from `Clock`), and add `update` to `TaskRepository` port and `InMemoryTaskRepository`; T072 must pass
- [X] T078 [P] [US2] Implement `UpdateTaskRequestSchema` (strict, `minProperties: 1`; optional `title` max 200, `description` max 5000, `status` enum, `assigneeId` uuid | null) in `packages/contracts/src/tasks.ts`
- [X] T079 [US2] Implement `update` in `apps/api/src/persistence/repositories/task-repository.ts` (`WHERE id = $1 AND board_id = $2 AND deleted_at IS NULL`, sets `updated_at = now()`, returns the updated row or not found) and route `PATCH /api/v1/tasks/:taskId` in `apps/api/src/http/routes/tasks.ts`; T073 must pass
- [X] T080 [P] [US2] Implement `useUpdateTask()` in `apps/web/src/api/tasks.ts` (pessimistic; on `TASK_NOT_FOUND` show "Esta tarea ya no existe." and refetch board) and per-task pending state helper `useIsTaskSaving(taskId)`
- [X] T081 [US2] Implement `StatusSelect` in `apps/web/src/features/tasks/StatusSelect.tsx` (native labelled `<select>`, disabled while saving, announces "Tarea movida a <estado>" on success, `ErrorAlert` with "Reintentar" on failure) and render it inside `TaskCard.tsx`
- [X] T082 [US2] Implement drag and drop in `apps/web/src/features/board/BoardDnd.tsx` with `@dnd-kit/core`: `PointerSensor`, `TouchSensor` (`delay: 250`, `tolerance: 5`) and an own keyboard mode on a "Mover «título»" handle (implemented instead of dnd-kit's `KeyboardSensor`, which moves by pixels and is not testable in jsdom: Space picks up, arrows jump between columns, Space drops, Escape cancels); columns as droppables highlighted while dragging over; cards not draggable while saving; drop on another column calls `useUpdateTask` (card stays in origin with "Guardando…" until confirmed); drop on same column or outside → no request; Spanish `announcements` and `screenReaderInstructions` from `apps/web/src/i18n/es.ts`; enabled only when `useIsWideLayout()` (`matchMedia('(min-width: 768px)')`, in `apps/web/src/features/board/useIsWideLayout.ts`) is true
- [X] T083 [US2] Wire `BoardDnd` into `apps/web/src/features/board/Board.tsx`; T074–T076 must pass

**Checkpoint**: US1 + US2 funcionan de forma independiente.

---

## Phase 5: User Story 6 - Gestionar las personas del equipo (Priority: P3)

**Goal**: Mantener la lista de personas asignables (añadir y quitar) desde la app.

**Independent Test**: añadir "Ana" y "Luis", rechazar "ana", quitar a Luis con confirmación y
comprobar que desaparece de la lista.

### Tests for User Story 6 ⚠️

- [X] T084 [P] [US6] Write domain tests in `packages/domain/tests/unit/use-cases/people.test.ts`: name trimmed, 1–50 chars (`""` → `too_short`, 51 → `too_long`); `"ana"` and `" Ana "` rejected with `PERSON_NAME_TAKEN` when "Ana" exists; same id + same name → replay; same id + other name → `ID_CONFLICT`; `listPeople` sorted by name with `assignedTaskCount` (non-deleted tasks only); `deletePerson` returns `unassignedTaskCount` and leaves those tasks with `assigneeId = null`; unknown id → `PERSON_NOT_FOUND`
- [X] T085 [P] [US6] Write API tests in `apps/api/tests/integration/people.test.ts`: `POST /api/v1/people` 201/200/409 (`PERSON_NAME_TAKEN`, `ID_CONFLICT`)/400; two concurrent creates of "Ana" and "ANA" → exactly one 201 and one 409 `PERSON_NAME_TAKEN` (unique index); `GET /api/v1/people`; `DELETE /api/v1/people/{id}` → 200 `{id, unassignedTaskCount}` and tasks unassigned; 404; contract validation for `listPeople`, `createPerson`, `deletePerson`
- [X] T086 [P] [US6] Write component tests in `apps/web/tests/people/people-dialog.test.tsx`: add form validation messages; duplicate name message "Ya existe una persona con ese nombre."; removal confirmation text "Se quitará a Luis. 3 tareas quedarán sin asignar."; cancel keeps the person; no axe violations
- [X] T087 [P] [US6] Write E2E test in `e2e/tests/us6-people.spec.ts`: open "Personas", add Ana and Luis, duplicate rejected, remove Luis with confirmation (desktop + mobile-320)

### Implementation for User Story 6

- [X] T088 [P] [US6] Implement `PersonName` (1–50 chars after normalization; comparison key = lowercase), `Person` entity and `PersonRepository` port (`insert`, `findById`, `findByNameKey`, `listWithAssignedCount`, `delete` returning unassigned count) in `packages/domain/src/people/person.ts`
- [X] T089 [US6] Implement use cases `createPerson`, `listPeople`, `deletePerson` in `packages/domain/src/use-cases/people.ts` and `InMemoryPersonRepository` (deleting a person nulls `assigneeId` in `InMemoryTaskRepository`) in `packages/domain/tests/support/in-memory.ts`; T084 must pass
- [X] T090 [P] [US6] Implement `PersonSchema` (`id`, `name` 1–50, `assignedTaskCount`), `CreatePersonRequestSchema` (strict), `ListPeopleResponseSchema`, `DeletePersonResponseSchema` in `packages/contracts/src/people.ts`
- [X] T091 [US6] Implement `KyselyPersonRepository` in `apps/api/src/persistence/repositories/person-repository.ts` (count of non-deleted assigned tasks via subquery; unique violation `23505` on `(board_id, lower(name))` → `PERSON_NAME_TAKEN`; delete inside a transaction that first counts affected tasks, relying on `ON DELETE SET NULL`)
- [X] T092 [US6] Implement routes `GET /api/v1/people`, `POST /api/v1/people`, `DELETE /api/v1/people/:personId` in `apps/api/src/http/routes/people.ts` and register them; T085 must pass
- [X] T093 [P] [US6] Implement `usePeople()`, `useCreatePerson()`, `useDeletePerson()` in `apps/web/src/api/people.ts` (pessimistic; deleting invalidates `['people']` and `['tasks']`; create reuses the same `crypto.randomUUID()` id on retry and generates a new one after `ID_CONFLICT`)
- [X] T094 [US6] Implement `PeopleDialog` in `apps/web/src/features/people/PeopleDialog.tsx` (list, add form with 50-char limit and field errors, remove button per person with confirmation dialog showing the assigned task count) and a "Personas" button in the header of `apps/web/src/app/App.tsx`; T086–T087 must pass

**Checkpoint**: US1, US2 y US6 funcionan de forma independiente.

---

## Phase 6: User Story 3 - Asignar una tarea a una persona (Priority: P3)

**Goal**: Asignar, reasignar o quitar el responsable al crear o después; "Sin asignar"
visible con texto e icono; sin responsable se permite cualquier estado.

**Independent Test**: crear una tarea, asignarla a Ana, reasignarla a Luis, quitar la
asignación y moverla a Hecha sin responsable.

### Tests for User Story 3 ⚠️

- [X] T095 [P] [US3] Write domain tests in `packages/domain/tests/unit/use-cases/assign-task.test.ts`: `createTask` with valid `assigneeId` stores it; with unknown or other-board person → `ASSIGNEE_NOT_FOUND`; `updateTask {assigneeId}` reassigns; `{assigneeId: null}` unassigns and keeps status; unassigned task can move to `in_progress` and `done`
- [X] T096 [P] [US3] Write API tests in `apps/api/tests/integration/tasks-assign.test.ts`: create with assignee → response `assignee {id, name}`; PATCH reassign / null; unknown person → 422 `ASSIGNEE_NOT_FOUND`; after `DELETE /people/{id}` the task shows `assignee: null`; contract validation
- [X] T097 [P] [US3] Write component tests in `apps/web/tests/tasks/assignee.test.tsx`: `AssigneeSelect` lists "Sin asignar" + people; with empty people list shows only "Sin asignar" and hint "Añade personas desde «Personas»"; card shows "Sin asignar" with icon and text (not color only); no axe violations
- [X] T098 [P] [US3] Write E2E test in `e2e/tests/us3-assign.spec.ts`: assign at creation, reassign, unassign, move unassigned task to Hecha (desktop + mobile-320)

### Implementation for User Story 3

- [X] T099 [US3] Extend `createTask` and `updateTask` in `packages/domain/src/use-cases/tasks.ts` to validate `assigneeId` through `PersonRepository.findById(boardId, id)` (→ `ASSIGNEE_NOT_FOUND`) and accept `null`; T095 must pass
- [X] T100 [US3] Ensure `KyselyTaskRepository` in `apps/api/src/persistence/repositories/task-repository.ts` persists `assignee_id` on insert/update and the routes in `apps/api/src/http/routes/tasks.ts` pass the `PersonRepository` to the use cases; T096 must pass
- [X] T101 [P] [US3] Implement `AssigneeSelect` in `apps/web/src/features/tasks/AssigneeSelect.tsx` (native labelled `<select>` with "Sin asignar" + people from `usePeople()`, disabled while saving, empty-list hint)
- [X] T102 [US3] Use `AssigneeSelect` in `apps/web/src/features/tasks/CreateTaskForm.tsx` (optional at creation) and in `apps/web/src/features/tasks/TaskDetailDialog.tsx` (change via `useUpdateTask`; `ASSIGNEE_NOT_FOUND` → "La persona elegida ya no está en el equipo." and refetch people); T097–T098 must pass

**Checkpoint**: US1, US2, US6 y US3 funcionan de forma independiente.

---

## Phase 7: User Story 4 - Buscar y filtrar tareas (Priority: P4)

**Goal**: Filtrar por responsable (persona, "Sin asignar", "Todos") y por uno o varios
estados, y buscar por texto sin distinguir mayúsculas ni tildes; todo combinado con AND.

**Independent Test**: con tareas de varios responsables y estados, aplicar "Ana" + "En
progreso" + búsqueda y comprobar el resultado; buscar "zzz" y ver el mensaje sin coincidencias.

### Tests for User Story 4 ⚠️

- [X] T103 [P] [US4] Write domain tests in `packages/domain/tests/unit/use-cases/task-criteria.test.ts`: `parseTaskCriteria` accepts `assignee` uuid | `'unassigned'` | absent; `statuses` subset of the 3 states; `text` trimmed, empty → no filter, > 100 chars → `VALIDATION_ERROR {field:'q', rule:'too_long', limit:100}`; in-memory list applies AND of all criteria with case- and accent-insensitive substring match on title or description
- [X] T104 [P] [US4] Write API tests in `apps/api/tests/integration/tasks-filter.test.ts`: `?assignee=<id>`, `?assignee=unassigned`, `?status=pending&status=in_progress`, `?q=revision` matches "Revisión de Diseño", `?q=50%` and `?q=a_b` treated literally, combined AND, `counts` reflect filtered results, invalid `status`/`assignee` → 400; contract validation
- [X] T105 [P] [US4] Write component tests in `apps/web/tests/filters/filters.test.tsx`: active filters always visible; "Limpiar búsqueda y filtros" resets all; no results with search → "No hay tareas que coincidan con «zzz»"; with filters only → "No hay tareas que coincidan con los filtros"; message announced; filters restored from `localStorage` and page still works when `localStorage` throws; creating a task hidden by filters shows notice; removed person in filter resets to "Todos" (US4 scenario 11)
- [X] T106 [P] [US4] Write E2E test in `e2e/tests/us4-search-filter.spec.ts`: combined filters, accent-insensitive search, no-results message and clear action, filters persisted after reload (desktop + mobile-320)

### Implementation for User Story 4

- [X] T107 [US4] Implement `parseTaskCriteria` and criteria matching for the in-memory repository in `packages/domain/src/tasks/task-criteria.ts`; use it in `listTasks` in `packages/domain/src/use-cases/tasks.ts`; T103 must pass
- [X] T108 [P] [US4] Implement `ListTasksQuerySchema` in `packages/contracts/src/tasks.ts`: `assignee` uuid | `'unassigned'` optional, `status` array (repeatable param, unique values of the enum) optional, `q` string max 100 optional
- [X] T109 [US4] Implement filters in `KyselyTaskRepository.list` and counts in `apps/api/src/persistence/repositories/task-repository.ts`: assignee (`= $id` / `IS NULL`), `status = ANY($statuses)`, text as `(unaccent(lower(title)) LIKE '%' || unaccent(lower($q)) || '%' ESCAPE '\' OR unaccent(lower(description)) LIKE … ESCAPE '\')` with `%`, `_` and `\` escaped in `$q`; route `GET /api/v1/tasks` uses `ListTasksQuerySchema`; T104 must pass
- [X] T110 [P] [US4] Implement `useFilters()` in `apps/web/src/features/filters/useFilters.ts`: state `{assignee, statuses, q}` persisted in `localStorage` key `taskflow.filters.v1` (every access wrapped in `try/catch`), search debounced 300 ms, `clearAll()`; `useTasks(filters)` in `apps/web/src/api/tasks.ts` passes them as query params
- [X] T111 [US4] Implement `FiltersBar` in `apps/web/src/features/filters/FiltersBar.tsx` (labelled search input `maxLength` 100, assignee select with "Todos"/"Sin asignar"/people, status checkboxes, "Limpiar búsqueda y filtros" button) and `NoResults` in `apps/web/src/features/filters/NoResults.tsx` with the exact messages of FR-026, announced via `LiveRegion`
- [X] T112 [US4] Integrate filters in `apps/web/src/app/App.tsx` and `apps/web/src/features/board/Board.tsx`: notice "La tarea se ha creado, pero no se muestra por los filtros activos." after creating a hidden task; reset assignee filter to "Todos" when the filtered person no longer exists; T105–T106 must pass

**Checkpoint**: US1–US4 y US6 funcionan de forma independiente.

---

## Phase 8: User Story 5 - Editar y borrar tareas (Priority: P5)

**Goal**: Editar título y descripción con las mismas reglas; borrar con confirmación y
"Deshacer" durante 10 s; borrado definitivo después.

**Independent Test**: editar una tarea y comprobarlo tras recargar; borrarla, deshacer;
borrarla de nuevo y esperar 10 s; no vuelve tras recargar.

### Tests for User Story 5 ⚠️

- [X] T113 [P] [US5] Write domain tests in `packages/domain/tests/unit/use-cases/edit-delete-task.test.ts`: `updateTask {title, description}` applies the same rules as creation and does not change status or assignee; `deleteTask` sets `deletedAt` and returns `undoUntil = deletedAt + 15 s`; deleted task excluded from `listTasks`/`getTask`; `restoreTask` within 15 s restores all fields; after 15 s → `UNDO_EXPIRED`; assignee removed during window → restored with `assigneeId = null`; restoring a non-deleted or unknown task → `TASK_NOT_FOUND`
- [X] T114 [P] [US5] Write API tests in `apps/api/tests/integration/tasks-edit-delete.test.ts`: PATCH title/description 200 and 400 rules; `DELETE` → 200 `{id, undoUntil}`; PATCH/GET on deleted → 404; with `FakeClock`: advance 14 s → `POST /restore` 200; advance 16 s → 410 `UNDO_EXPIRED`; run `purgeDeletedTasks` after advancing 16 s → row physically removed; contract validation for `deleteTask` and `restoreTask`
- [X] T115 [P] [US5] Write component tests in `apps/web/tests/tasks/edit-delete.test.tsx`: edit dialog validation and cancel without changes; delete confirmation shows the task title; undo toast "Tarea borrada" with "Deshacer" visible 10 s, keyboard operable, announced; if focused at 10 s, stays visible but "Deshacer" becomes disabled and "Ya no se puede deshacer" is announced; `UNDO_EXPIRED` → "Ya no se puede deshacer."; no axe violations
- [X] T116 [P] [US5] Write E2E test in `e2e/tests/us5-edit-delete.spec.ts`: edit and reload; delete + undo; delete + wait 10 s + reload → gone (desktop + mobile-320)

### Implementation for User Story 5

- [X] T117 [US5] Extend `updateTask` for `title`/`description` and implement `deleteTask` (sets `deletedAt = clock.now()`), `restoreTask` (compares `clock.now() - deletedAt` with `UNDO_WINDOW_SERVER_MS`) and `purgeDeletedTasks(clock)` (calls `purgeDeletedBefore(clock.now() - UNDO_WINDOW_SERVER_MS)`) in `packages/domain/src/use-cases/tasks.ts`; add `softDelete`, `findDeletedById`, `restore`, `purgeDeletedBefore` to the `TaskRepository` port and `InMemoryTaskRepository`; T113 must pass
- [X] T118 [P] [US5] Implement `DeleteTaskResponseSchema` (`id`, `undoUntil`) in `packages/contracts/src/tasks.ts`
- [X] T119 [US5] Implement `softDelete` (writes the `deletedAt` value received from the domain, never SQL `now()`), `findDeletedById`, `restore`, `purgeDeletedBefore(date)` (deletes rows with `deleted_at < $date`) in `apps/api/src/persistence/repositories/task-repository.ts` and routes `DELETE /api/v1/tasks/:taskId`, `POST /api/v1/tasks/:taskId/restore` in `apps/api/src/http/routes/tasks.ts`
- [X] T120 [US5] Implement purge job in `apps/api/src/jobs/purge-deleted-tasks.ts` (every 60 s invokes the `purgeDeletedTasks` use case with the system `Clock`; started and stopped from `apps/api/src/main.ts`); T114 must pass
- [X] T121 [P] [US5] Implement `useDeleteTask()` and `useRestoreTask()` in `apps/web/src/api/tasks.ts` (pessimistic; invalidate `['tasks']` on success)
- [X] T122 [US5] Implement `EditTaskForm` inside `apps/web/src/features/tasks/TaskDetailDialog.tsx` (same fields and validation as creation, "Guardar" / "Cancelar")
- [X] T123 [US5] Implement `DeleteTaskConfirm` in `apps/web/src/features/tasks/DeleteTaskConfirm.tsx` ("¿Borrar la tarea «<título>»?") and `UndoDeleteToast` in `apps/web/src/features/tasks/UndoDeleteToast.tsx` (10 s timer never paused; at expiry disable "Deshacer" and announce "Ya no se puede deshacer"; hide the toast at expiry or on blur, whichever is later); T115–T116 must pass

**Checkpoint**: todas las historias funcionan de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Regeneración del enlace (FR-028b), calidad transversal y validación final.

### Enlace secreto (FR-028b)

- [X] T124 [P] Write API tests in `apps/api/tests/integration/regenerate-link.test.ts`: `POST /api/v1/board/access-code/regenerate` → 200 with new 43-char code and `Cache-Control: no-store`; old code → 401 `INVALID_LINK` immediately; new code works; neither the response headers nor any captured log line contain the old or new code; `Content-Security-Policy` includes `connect-src 'self'` (no third-party requests); contract validation
- [X] T125 Implement route `POST /api/v1/board/access-code/regenerate` in `apps/api/src/http/routes/board.ts`; T124 must pass
- [X] T126 Implement `ShareLinkDialog` in `apps/web/src/features/access/ShareLinkDialog.tsx`: shows the current link with "Copiar enlace"; "Regenerar enlace" requires confirmation explaining that the old link stops working; on success updates the code with `setAccessCode` and shows the new link to copy; add "Compartir" button in `apps/web/src/app/App.tsx`
- [X] T127 [P] Write E2E test in `e2e/tests/access.spec.ts`: wrong code shows "Enlace no válido" with no data; regenerating in one context makes the other context show "Enlace no válido" on its next action

### Calidad transversal

- [X] T128 [P] Write E2E accessibility and responsive suite in `e2e/tests/a11y-responsive.spec.ts`: axe scan with WCAG 2.1 AA tags on board, dialogs and toasts; at 320 px `document.documentElement.scrollWidth <= clientWidth`; all interactive elements ≥ 44×44 px; full keyboard pass of create, status change, assign, filter, delete/undo
- [X] T129 [P] Write E2E performance check in `e2e/tests/performance.spec.ts`: seed 200 tasks via API, then board load, search, filter and status change each reflect in < 1 s (SC-003)
- [X] T130 [P] Write E2E resilience test in `e2e/tests/save-failure.spec.ts`: for create, edit, assign, delete and add-person, aborted request → no change on board, typed values kept, "Reintentar" works once; delayed response > 10 s → timeout error; retrying a create after timeout yields exactly one task (FR-011, FR-021a, SC-008)
- [X] T131 [P] Handle `RATE_LIMITED` globally in `apps/web/src/api/client.ts` and `apps/web/src/ui/ErrorAlert.tsx` with message "Demasiadas acciones seguidas. Espera unos segundos."
- [X] T132 [P] Write `README.md` at the repository root: purpose, prerequisites, link to `specs/001-kanban-task-board/quickstart.md`, scripts, and security notes (link is a secret, how to rotate, backups pending for deployment)
- [X] T133 Run `npm run lint`, `npm run lint:deps`, `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm audit --audit-level=high`; fix any failure (no task is done while tests fail)
- [ ] T134 Run the manual validation in `specs/001-kanban-task-board/quickstart.md` (sections 1–6) plus a manual screen reader review (NVDA or VoiceOver) of create, status change, drag and drop, assign, filter and delete/undo against WCAG 2.1 AA (SC-006), and record results in `specs/001-kanban-task-board/checklists/quickstart-run.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de US1 (necesita tareas y tablero).
- **US6 (Phase 5)**: depende solo de Foundational (puede ir en paralelo con US1/US2).
- **US3 (Phase 6)**: depende de US1 y US6.
- **US4 (Phase 7)**: depende de US1; el filtro por responsable usa US6/US3 si están presentes.
- **US5 (Phase 8)**: depende de US1 (edición reutiliza `updateTask` de US2).
- **Polish (Phase 9)**: depende de las historias que se vayan a entregar.

### User Story Dependencies

```text
Setup → Foundational ─┬─▶ US1 (P1) ─┬─▶ US2 (P2) ──▶ US5 (P5)
                      │             ├─▶ US4 (P4)
                      └─▶ US6 (P3) ─┴─▶ US3 (P3)
```

### Within Each User Story

- Las pruebas se escriben primero y DEBEN fallar antes de implementar.
- Dominio (entidades → casos de uso) → contratos → repositorio → rutas → hooks web → UI.
- Una historia no se da por terminada si alguna de sus pruebas falla (constitución).

### Parallel Opportunities

- Setup: T003–T010, T012, T013 en paralelo tras T001–T002.
- Foundational: T014–T017, T019, T020, T025–T026 en paralelo; migraciones T029–T032 en
  paralelo; T039–T040 y T047–T048, T050–T051 en paralelo.
- Tras Foundational: US1 y US6 pueden desarrollarse en paralelo por personas distintas.
- Dentro de cada historia: todas las tareas de pruebas marcadas [P] en paralelo; contratos y
  entidades de dominio [P] en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (deben fallar):
Task: "T054 Domain tests createTask in packages/domain/tests/unit/use-cases/create-task.test.ts"
Task: "T055 Domain tests listTasks in packages/domain/tests/unit/use-cases/list-tasks.test.ts"
Task: "T056 API tests in apps/api/tests/integration/tasks-create.test.ts"
Task: "T057 Contract tests in apps/api/tests/contract/tasks.contract.test.ts"
Task: "T058 Component tests in apps/web/tests/board/board.test.tsx"
Task: "T059 E2E in e2e/tests/us1-board-create.spec.ts"

# Modelos y contratos en paralelo:
Task: "T060 Task entity in packages/domain/src/tasks/task.ts"
Task: "T063 Task schemas in packages/contracts/src/tasks.ts"
```

## Parallel Example: User Story 6

```bash
Task: "T084 Domain tests in packages/domain/tests/unit/use-cases/people.test.ts"
Task: "T085 API tests in apps/api/tests/integration/people.test.ts"
Task: "T086 Component tests in apps/web/tests/people/people-dialog.test.tsx"
Task: "T088 Person entity in packages/domain/src/people/person.ts"
Task: "T090 People schemas in packages/contracts/src/people.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational).
2. Completar Phase 3 (US1).
3. **PARAR Y VALIDAR**: escenarios 1–4 de `quickstart.md` y `npm test` en verde.
4. Demostrar el MVP: tablero compartido con creación y detalle de tareas.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → demo (MVP).
3. US2 (estado + arrastrar y soltar) → validar → demo.
4. US6 + US3 (personas y asignación) → validar → demo.
5. US4 (búsqueda y filtros) → validar → demo.
6. US5 (editar, borrar, deshacer) → validar → demo.
7. Polish (enlace, accesibilidad, rendimiento, resiliencia) → validación final.

### Parallel Team Strategy

1. Todo el equipo: Setup + Foundational.
2. Después: Dev A → US1 → US2 → US5; Dev B → US6 → US3; Dev C → US4 tras US1.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [USx] mapea la tarea a la historia de `spec.md` para trazabilidad.
- Cada historia es completable y comprobable de forma independiente.
- Hacer commit tras cada tarea o grupo lógico.
- Ninguna tarea se marca como hecha si sus pruebas fallan (constitución).
- Decisiones D1–D10 de `plan.md` aprobadas el 2026-10-17.

---

## Phase 10: Convergence

- [X] T135 Make per-IP rate limits identify the real client behind the web proxy: explain the approach (e.g. `TRUST_PROXY` env with the proxy's address, `xfwd: true` in the Vite proxy) and get user approval before applying it (Constitution: security decision), then configure `trustProxy` in `apps/api/src/http/app.ts` and `apps/web/vite.config.ts`, with a test proving that 20 failed attempts from one client do not block another client per plan: D5 (contradicts)
- [X] T136 Add a `Retry-After` header to the `429 RATE_LIMITED` response sent by the unauthorized-attempts limiter in `apps/api/src/http/plugins/auth.ts` and assert it in `apps/api/tests/integration/rate-limit.test.ts` per contracts/openapi.yaml `RateLimited` (partial)
- [X] T137 Make the card title button span the full card width so every tap target is at least 44×44 px in `apps/web/src/features/board/board.css`, with a check in `e2e/tests/us1-board-create.spec.ts` per FR-033 (partial)
- [X] T138 Define and apply a Content-Security-Policy for the web document (`default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`; dev-only relaxations for Vite HMR documented) in `apps/web/vite.config.ts` per plan: D5 (partial)
- [X] T139 Declare the `413` response for `createTask`/`updateTask` and the `400` response for `getTask` (invalid `taskId`) in `specs/001-kanban-task-board/contracts/openapi.yaml` and validate them in `apps/api/tests/contract/tasks.contract.test.ts` per plan: contracts (partial)
- [X] T140 Document the `RATE_LIMIT_GLOBAL`, `RATE_LIMIT_WRITES` and `RATE_LIMIT_UNAUTHORIZED` variables (configurable, minimum 1, never disabled) in `specs/001-kanban-task-board/research.md` R8 and `specs/001-kanban-task-board/quickstart.md` per plan: D5 (unrequested)
- [X] T141 Run the axe WCAG 2.1 AA audit also with `colorScheme: 'dark'` in `e2e/tests/us1-board-create.spec.ts`, or remove the dark theme from `apps/web/src/ui/tokens.css`, per FR-031 / SC-006 (unrequested)
- [X] T142 Add tests for `boardLink` (fragment `#k=`, trailing slashes) and for `board:init` printing the code only on first creation in `apps/api/tests/cli/board-cli.test.ts` per Constitution IV (partial)

---

## Phase 11: Convergence

- [X] T143 On `TASK_NOT_FOUND` when editing or deleting from the detail dialog, show "Esta tarea ya no existe.", refetch the board, close the dialog and do not offer "Reintentar" in `apps/web/src/features/tasks/EditTaskForm.tsx` and `apps/web/src/features/tasks/DeleteTaskConfirm.tsx`, with component tests in `apps/web/tests/tasks/edit-delete.test.tsx` per FR-013b (partial)
- [X] T144 On `PERSON_NOT_FOUND` when removing a person, show "Esta persona ya no está en el equipo." and refetch people and tasks in `apps/web/src/features/people/PeopleDialog.tsx`, with a test in `apps/web/tests/people/people-dialog.test.tsx` per plan: error table (partial)
- [X] T145 Announce the real origin column when a pointer/touch drag starts (instead of "Columna actual: .") in `apps/web/src/features/board/BoardDnd.tsx` per FR-019a (partial)
- [X] T146 Declare the `400` response (invalid UUID) for `deleteTask`, `restoreTask` and `deletePerson` in `specs/001-kanban-task-board/contracts/openapi.yaml` and validate them in `apps/api/tests/contract/` per plan: contracts (partial)

---

## Phase 12: Correcciones (issues)

- [X] T147 [US2] Regression test (must fail before T148): after pressing the pointer on the status select and changing the status, moving the pointer does not start a drag of the card, in `apps/web/tests/board/drag-and-drop.test.tsx` per spec edge case "Controles dentro de la tarjeta" (#11)
- [X] T148 [US2] Stop `pointerdown`/`touchstart` propagation from the status select so the card's dnd-kit listeners never arm a drag from it, in `apps/web/src/features/tasks/StatusSelect.tsx` per spec edge case "Controles dentro de la tarjeta" (#11)
