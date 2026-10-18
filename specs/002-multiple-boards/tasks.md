---

description: "Lista de tareas para implementar múltiples tableros (feature 002)"
---

# Tasks: Múltiples tableros (uno por equipo)

**Input**: Design documents from `/specs/002-multiple-boards/`

**Prerequisites**: plan.md, spec.md, research.md (R18–R27), data-model.md,
contracts/openapi.yaml (1.1.0), quickstart.md

**Tests**: INCLUIDAS. La constitución (Principio IV, no negociable) exige pruebas de la gestión
de tableros, la autorización, la validación y las migraciones. Las pruebas de cada historia se
escriben primero y DEBEN fallar antes de implementar.

**Gate**: decisiones D12–D16 de `plan.md` aprobadas por el usuario el 2026-10-17 (D13 en su
opción B: el código lo genera siempre el servidor). Cualquier decisión nueva de arquitectura
o seguridad que surja durante la implementación debe explicarse y aprobarse antes de
aplicarse.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo de la 001: `packages/domain/`, `packages/contracts/`, `apps/api/`, `apps/web/`,
`e2e/`. Contrato vigente: `specs/002-multiple-boards/contracts/openapi.yaml`. Mensaje
reutilizado en varias tareas, `LOST_LINK`: "El tablero se creó, pero no se pudo mostrar su
enlace. Crea otro tablero."

**Orden de historias**: US1 (P1) → US2 (P1) → US3 (P2) → US4 (P3), y después la consola
(FR-119). US2 necesita poder crear dos tableros (US1).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuración nueva y contrato vigente.

- [X] T001 [P] Add to `EnvSchema` in `apps/api/src/config/env.ts`: `BOARD_CREATION_ENABLED` (only the strings `true`/`false`, default `true`, transformed to boolean; any other value is a configuration error) and `BOARD_CREATION_PER_HOUR` (`z.coerce.number().int().min(1).max(100_000).default(10)`, FR-105); extend `apps/api/tests/config/env.test.ts` with defaults, `false`, invalid `yes`, `0` and `abc`
- [X] T002 [P] Add `BOARD_CREATION_ENABLED=true` and `BOARD_CREATION_PER_HOUR=10` to `.env.example`, pass both to the `api` service in `docker-compose.yml` (the `migrate` service keeps `board:init`), and set `BOARD_CREATION_PER_HOUR=1000` in the E2E API `webServer.env` of `e2e/playwright.config.ts`
- [X] T003 Point `CONTRACT_PATH` in `apps/api/tests/contract/openapi.ts` to `specs/002-multiple-boards/contracts/openapi.yaml` (research R25, D16) and update the contract path mentioned in `CLAUDE.md` (sección "Fuente de verdad", punto 3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tablero con nombre en todas las capas, migración, puerto ampliado, caso de uso
`createBoard` y consola mínima. **Ninguna historia empieza antes de terminar esta fase.**

### Dominio

- [X] T004 [P] Add `BOARD_NAME_MIN = 1`, `BOARD_NAME_MAX = 60` and `DEFAULT_BOARD_NAME = 'Mi tablero'` to `packages/domain/src/shared/limits.ts` and `{ readonly code: 'BOARD_NOT_FOUND' }` to `DomainError` in `packages/domain/src/shared/errors.ts`
- [X] T005 [P] Write failing tests for `parseBoardName` in `packages/domain/tests/unit/shared/board-name.test.ts`: trims and normalizes NFC; `""` and `"   "` → `{field: 'name', rule: 'too_short', limit: 1}` (implemented with the existing convention of `parsePersonName` and titles instead of `required`, so the web reuses the same message); 61 code points → `{rule: 'too_long', limit: 60}`; 60 code points (including an emoji counted as one) → valid; `<b>x</b>` is kept literally
- [X] T006 Extend `packages/domain/src/board/board.ts`: `Board` gains `name: string` and `updatedAt: Date`; add `parseBoardName` (same normalization as `PersonName` in `packages/domain/src/people/person.ts`, limits from T004), `BoardStats { taskCount, personCount }`, `BoardSummary { id, name, createdAt, taskCount, personCount, lastActivityAt }`; change `BoardRepository` exactly as data-model.md: remove `findAny`, add `findById(id)`, `count()`, `insert(board) → 'inserted' | 'id_taken'`, `rename(id, name, updatedAt)`, `delete(id) → boolean`, `getStats(id)`, `listSummaries()`, and `updateAccessCodeHash` also sets `updatedAt`; export the new names from `packages/domain/src/index.ts`
- [X] T007 Update `InMemoryBoardRepository` in `packages/domain/tests/support/in-memory.ts` to the new port (`getStats`/`listSummaries` computed from the in-memory task and person repositories)
- [X] T008 Write failing tests in `packages/domain/tests/unit/use-cases/board.test.ts`: `createBoard({id, name})` → `{created: true, board, accessCode}` with name normalized, `createdAt = updatedAt = clock.now()` and only the hash stored; repeating the same `id` and normalized name → `{created: false, board}` without `accessCode`; same `id` with another name → `ID_CONFLICT`; invalid name → `VALIDATION_ERROR` and nothing stored; `initBoard` creates `DEFAULT_BOARD_NAME` only when `count() = 0`; `regenerateAccessCode` sets `updatedAt`; `getBoardDetails(boardId)` returns the board plus `taskCount` (non-deleted tasks) and `personCount`
- [X] T009 Implement `createBoard`, `getBoardDetails` and the updated `initBoard`/`regenerateAccessCode` in `packages/domain/src/use-cases/board.ts` (rules 1–4 of data-model.md "Reglas de `createBoard`"; `initBoard` reuses `createBoard`)

### Persistencia

- [X] T010 [P] Write failing test for migration `0005_board_name` in `apps/api/tests/migrations/migrations.test.ts`: with a board, a person and a task inserted at `0004`, `up` keeps all rows, sets `name = 'Mi tablero'` and `updated_at = created_at`, has no default on `name` and rejects `''` and 61-character names (`CHECK (char_length(name) BETWEEN 1 AND 60)`); `down` returns to the `0004` schema keeping person and task
- [X] T011 Create `apps/api/src/persistence/migrations/0005_board_name.ts` exactly as the "Migraciones" table of data-model.md, register it in `apps/api/src/persistence/migrations/index.ts`, and add `name: string` and `updated_at: Date` to `BoardTable` in `apps/api/src/persistence/db.ts`
- [X] T012 Write failing integration tests in `apps/api/tests/integration/board-repository.test.ts` and implement the new port in `apps/api/src/persistence/repositories/board-repository.ts`: `insert` returns `'id_taken'` on the primary-key unique violation; `delete` removes the board and, by cascade, its people and tasks (also soft-deleted ones); `getStats` counts non-deleted tasks; `listSummaries` orders by `created_at` and computes `lastActivityAt = greatest(board.updated_at, max(task.updated_at), max(task.deleted_at), max(person.created_at))` (research R24); every date comes from the domain, never `now()`

### Contratos y web base

- [X] T013 [P] Update `packages/contracts/src/board.ts`: `BoardSchema = {id, name (1–60), accessCodeRotatedAt, taskCount, personCount}`, `CreateBoardRequestSchema` strict `{id: uuid, name: string max 60}`, `CreatedBoardSchema {id, name}`, `CreatedBoardWithCodeSchema {id, name, accessCode: ACCESS_CODE_PATTERN}`, `RenameBoardRequestSchema` strict `{name: string max 60}`, `PublicConfigSchema {boardCreationEnabled: boolean}`; add `BOARD_CREATION_DISABLED` and `BOARD_CREATION_LIMITED` to `ERROR_CODES` in `packages/contracts/src/problem.ts` (the order must match `contracts/openapi.yaml`); cover them in `packages/contracts/tests/`
- [X] T014 [P] Add to `apps/web/src/i18n/es.ts` the texts of plan.md "Validación y manejo de errores" (`BOARD_CREATION_DISABLED`, `BOARD_CREATION_LIMITED`, creation `ID_CONFLICT`, `LOST_LINK`, name `required`/`too_long` with limit 60) and the labels of the new screens: "Crear tablero", "Crear un tablero nuevo", "Nombre del tablero", "Copiar enlace", "Abrir tablero", "Guarda este enlace: no se volverá a mostrar", "No podrás volver a ver este enlace. ¿Cerrar de todos modos?", "Tablero", "Cambiar nombre", "Borrar tablero", "Tablero «{nombre}» borrado"

### Rutas existentes y consola mínima

- [X] T015 Make `GET /api/v1/board` in `apps/api/src/http/routes/board.ts` return `getBoardDetails` (`name`, `taskCount`, `personCount`); add the `getBoard` case to a new `apps/api/tests/contract/boards.contract.test.ts` and update the existing assertions on `GET /board` in `apps/api/tests/integration/access.test.ts`
- [X] T016 Create `apps/api/src/cli/args.ts` (wrapper around `node:util.parseArgs` that validates `--name` with `parseBoardName`, `--board` as a UUID and `--confirm` as text, and prints a clear Spanish message + exit code 1 on error) and `apps/api/src/cli/board-create.ts` (`createBoard` with `uuidGenerator`, prints the link once with `boardLink`); add script `board:create` to `apps/api/package.json`; add tests to `apps/api/tests/cli/board-cli.test.ts` (prints the link once; missing or blank `--name` → exit 1 and no board)
- [X] T017 Make `apps/api/src/cli/board-rotate.ts` accept `--board <id>`: required when `count() > 1` (otherwise exit 1 with "Hay varios tableros: indica --board <id> (ver board:list)"), optional with exactly one board (current behaviour); unknown id → "No existe ningún tablero con ese id", exit 1 (FR-119a); extend `apps/api/tests/cli/board-cli.test.ts`
- [X] T018 Change `e2e/global-setup.ts` to obtain the E2E code with `board:create --name "E2E"` instead of `board:init` + `board:rotate`, so that it keeps working when other tests have created more boards (T050 later makes it reuse that board instead of creating one per run)

**Checkpoint**: `npm test` en verde; la instalación existente funciona igual con "Mi tablero".

---

## Phase 3: User Story 1 - Crear un tablero para mi equipo (Priority: P1) 🎯 MVP

**Goal**: desde la pantalla de inicio, crear un tablero con nombre, ver su enlace una vez,
copiarlo y abrir el tablero vacío con su nombre en la cabecera.

**Independent Test**: crear "Equipo Diseño" desde `/`, copiar el enlace, abrirlo en otra
ventana y crear una tarea en el tablero vacío que muestra ese nombre.

### Tests for User Story 1 ⚠️

- [X] T019 [P] [US1] Write failing integration tests in `apps/api/tests/integration/boards-create.test.ts`: `POST /api/v1/boards` without `Authorization` → `201 {id, name, accessCode}` (43 characters) with `Cache-Control: no-store`, and `GET /board` with that code returns the name; same `id` and name → `200 {id, name}` without `accessCode`; same `id` and another name → `409 ID_CONFLICT`; `"   "` → `400` `required`; 61 characters → `400` `too_long` limit 60; extra field → `400`; with `BOARD_CREATION_ENABLED=false` → `403 BOARD_CREATION_DISABLED` and no row; with `perHour = 2` the third new creation → `429 BOARD_CREATION_LIMITED` with `Retry-After`, while replays and `400`s do not count; two client IPs behind `TRUST_PROXY` have separate limits; the code never appears in the captured log output; `GET /api/v1/public-config` → `{boardCreationEnabled}` in both configurations without authentication
- [X] T020 [P] [US1] Add the `createBoard` (201/200/400/403/409/429) and `getPublicConfig` cases to `apps/api/tests/contract/boards.contract.test.ts`
- [X] T021 [P] [US1] Write failing web tests in `apps/web/tests/home/create-board.test.tsx` (extend `apps/web/tests/support/fake-server.ts` with `public-config`, `POST /boards` and `GET /board`): without a code `HomePage` shows "Crear tablero" and the explanation of the link; with creation disabled there is no button; `InvalidLinkPage` offers "Crear un tablero nuevo"; a blank name shows the message next to the field without a request, and the field does not accept more than 60 characters (implemented as the existing `clampChars` limit, like titles and people, instead of a message for 61); "Guardando…" with the control disabled; on `201` the dialog shows `${origin}${pathname}#k=<code>`, "Copiar enlace" announces the copy, and "Abrir tablero" shows the board with the name in the `h1` and `document.title = "«nombre» · TaskFlow"`; closing without copying or opening asks for the FR-103a confirmation, "Cancelar" keeps the dialog, and after copying it closes directly; on `200` it shows `LOST_LINK` and the next attempt uses a new `id`; on error or timeout `ErrorAlert` with "Reintentar" reuses the same `id` and keeps the name; `403`/`429` messages; no axe violations

### Implementation for User Story 1

- [X] T022 [US1] Create `apps/api/src/http/routes/boards.ts`: `GET /public-config`, and `POST /boards` checking, in order, the switch (`403`), `FixedWindowLimiter(perHour, 3_600_000)` keyed by `request.ip` (`isBlocked` → `429 BOARD_CREATION_LIMITED` + `Retry-After`; `hit` only when `created: true`), the schema, and `createBoard`; respond `201` or `200` with `Cache-Control: no-store` (research R18, R19)
- [X] T023 [US1] In `apps/api/src/http/app.ts`, add `boardCreation?: { enabled: boolean; perHour: number }` to `AppDeps` and register `boardRoutes` from T022 in a sibling encapsulated scope of the authenticated one inside `/v1`, so the `auth` hook does not apply to it; pass the env values from `apps/api/src/main.ts`; allow overriding them in `apps/api/tests/support/test-app.ts`
- [X] T024 [US1] Add an `auth?: false` option to `RequestOptions` in `apps/web/src/api/client.ts` (does not send `Authorization` or call `onInvalidLink`); create `apps/web/src/api/boards.ts` with `usePublicConfig` and `useCreateBoard`, and add `useBoard` (query of `GET /board`) to `apps/web/src/api/board.ts`
- [X] T025 [US1] Create `apps/web/src/features/home/HomePage.tsx`, `CreateBoardForm.tsx` (one `crypto.randomUUID()` per attempt, reused by "Reintentar", renewed after `200` or `409`), `NewBoardLinkDialog.tsx` (tracks copied/opened for FR-103a) and `home.css`, reusing `Dialog`, `Button`, `ErrorAlert` and `useAnnounce` from `apps/web/src/ui/`; 44×44 px targets and no horizontal scroll at 320 px
- [X] T026 [US1] Add the create action to `apps/web/src/features/access/InvalidLinkPage.tsx` when `boardCreationEnabled`, without showing any board data (FR-107)
- [X] T027 [US1] In `apps/web/src/app/App.tsx`, render `HomePage` without a code, `InvalidLinkPage` on `INVALID_LINK`, and the board with its name in the header `h1` (fallback `es.appName` while loading) and in `document.title` (`"TaskFlow"` when no board is open); "Abrir tablero" calls `setAccessCode` and clears the query cache; add `clearAccessCode()` (memory + remove the fragment with `replaceState`) to `apps/web/src/app/access-code.ts`
- [X] T028 [US1] Write `e2e/tests/boards.spec.ts` (US1 block): open `/`, create "Equipo Diseño", copy and open the link, create a task; desktop and `mobile-320`, with axe

**Checkpoint**: US1 funciona por sí sola: un equipo nuevo crea su tablero sin consola.

---

## Phase 4: User Story 2 - Tableros aislados entre equipos (Priority: P1)

**Goal**: demostrar que con el enlace de un tablero no se ve ni se modifica nada de otro.

**Independent Test**: tableros A y B; la tarea "Solo A" y la persona "Ana" de A no aparecen
en B, ni en el tablero, ni en la búsqueda, ni en el filtro de responsable.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Write integration tests in `apps/api/tests/integration/board-isolation.test.ts` with two boards created through `POST /boards` (research R27): with B's code, `GET`/`PATCH`/`DELETE`/`restore` of an A task → `404 TASK_NOT_FOUND` and the A task unchanged; `DELETE` of an A person → `404 PERSON_NOT_FOUND`; assigning an A person to a B task → `422 ASSIGNEE_NOT_FOUND`; `GET /tasks` with `q` and `assignee` and `GET /people` return only B data and counts; both boards can have a person "Ana"; regenerating A's code leaves B's working
- [X] T030 [P] [US2] Add the US2 block to `e2e/tests/boards.spec.ts`: create A with "Solo A" and "Ana", create and open B, check that neither appears and that B accepts another "Ana"

### Implementation for User Story 2

- [X] T031 [US2] Run T029–T030; if any check fails, add the missing `board_id` filter in the repository involved (`apps/api/src/persistence/repositories/task-repository.ts` or `person-repository.ts`) or in the use case of `packages/domain/src/use-cases/`, with a test that reproduces the failure (constitución IV), and record the finding in this task
  - **Resultado (2026-10-17)**: ningún filtro por `board_id` falta; T029 pasa sin cambios en la API. Para comprobar que las pruebas no son vacías se quitaron temporalmente los filtros de tablero de `task-repository.ts` (3 pruebas fallan) y de `person-repository.ts` (2 fallan), y se restauraron.
  - **Defecto encontrado y corregido** (anterior a la 002): al pegar el enlace de otro tablero en la misma pestaña, la app vaciaba la caché pero no volvía a montar el tablero, y podía seguir mostrando datos del anterior (fallo intermitente del E2E de T030). Prueba de regresión `apps/web/tests/access/switch-board.test.tsx`; arreglo en `apps/web/src/app/App.tsx` (el tablero se vuelve a montar con cada código).
  - **Observación, sin cambios**: los ids de tareas y personas son globales; reutilizar en B un id de A da `409 ID_CONFLICT` sin revelar datos de A (probado). Solo confirma que ese UUID existe en algún tablero; evitarlo requeriría claves compuestas `(board_id, id)`, que es un cambio de esquema. **Riesgo aceptado por el usuario el 2026-10-17**: se mantienen los ids globales.

**Checkpoint**: US1 + US2 = MVP seguro para varios equipos.

---

## Phase 5: User Story 3 - Ver y cambiar el nombre del tablero (Priority: P2)

**Goal**: cambiar el nombre desde la web con guardado pesimista.

**Independent Test**: renombrar "Equipo Diseño" a "Diseño y UX", recargar en otro navegador y
ver el nombre nuevo en la cabecera y la pestaña.

### Tests for User Story 3 ⚠️

- [X] T032 [P] [US3] Add failing tests for `renameBoard(boardId, name)` to `packages/domain/tests/unit/use-cases/board.test.ts`: normalizes the name, sets `updatedAt = clock.now()`, invalid name → `VALIDATION_ERROR` without changes; if the board no longer exists → `BOARD_NOT_FOUND`
- [X] T033 [P] [US3] Write failing integration tests in `apps/api/tests/integration/board-manage.test.ts` (rename block): `PATCH /api/v1/board {name: "  Diseño y UX "}` → `200 Board` with `name: "Diseño y UX"`; blank and 61 characters → `400`; extra field → `400`; the other board is unchanged; with a regenerated code → `401 INVALID_LINK`; renaming a board that disappears between authentication and the write (board repository double that reports it as not found after `auth` resolved it) → `401 INVALID_LINK` (implemented with a new optional `AppDeps.boards`, used only by tests, whose `rename` deletes the board first)
- [X] T034 [P] [US3] Add the `renameBoard` case (200/400/401) to `apps/api/tests/contract/boards.contract.test.ts`
- [X] T035 [P] [US3] Write failing web tests in `apps/web/tests/access/board-settings.test.tsx` (rename): the "Tablero" menu opens "Cambiar nombre" with the current name; validation messages next to the field; "Guardando…"; on success the header and `document.title` update only after the response; on error or timeout the name does not change, the text is kept and "Reintentar" is offered; no axe violations

### Implementation for User Story 3

- [X] T036 [US3] Implement `renameBoard` in `packages/domain/src/use-cases/board.ts`
- [X] T037 [US3] Add `PATCH /board` with `RenameBoardRequestSchema` to `apps/api/src/http/routes/board.ts`, returning the same shape as `GET /board`; map `BOARD_NOT_FOUND` to `401 INVALID_LINK` in `apps/api/src/http/plugins/error-handler.ts`
- [X] T038 [US3] Add `useRenameBoard` (invalidates `useBoard`) to `apps/web/src/api/board.ts`, create `apps/web/src/features/access/RenameBoardDialog.tsx`, and add a "Tablero" menu with "Cambiar nombre" to the header actions in `apps/web/src/app/App.tsx`
- [X] T039 [US3] Add the US3 block (rename and reload) to `e2e/tests/boards.spec.ts`

**Checkpoint**: US1–US3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Borrar un tablero (Priority: P3)

**Goal**: borrado definitivo con confirmación escribiendo el nombre exacto.

**Independent Test**: en un tablero con tareas y personas, borrarlo escribiendo su nombre;
volver al inicio con el aviso, y el enlace da "Enlace no válido".

### Tests for User Story 4 ⚠️

- [X] T040 [P] [US4] Add failing tests for `deleteBoard(boardId)` to `packages/domain/tests/unit/use-cases/board.test.ts`: removes the board and its tasks and people from the in-memory repositories; unknown id → `BOARD_NOT_FOUND`; other boards untouched
- [X] T041 [P] [US4] Add the delete block to `apps/api/tests/integration/board-manage.test.ts`: `DELETE /api/v1/board` → `204`; afterwards `GET /board`, `GET /tasks`, `POST /tasks` and `GET /people` with that code → `401 INVALID_LINK` identical to an invalid code; no `person` or `task` rows (including soft-deleted) remain for that `board_id`; the other board and its data are intact; a route registered only in the test that throws a `pg` error `{code: '23503', constraint: 'task_board_id_fkey'}` (and `person_board_id_fkey`) → `401 INVALID_LINK` (research R20); a second `DELETE /board` with the same code → `401 INVALID_LINK`
- [X] T042 [P] [US4] Add the `deleteBoard` case (204/401) to `apps/api/tests/contract/boards.contract.test.ts`
- [X] T043 [P] [US4] Add web tests to `apps/web/tests/access/board-settings.test.tsx` (delete): the confirmation shows the name, `taskCount` and `personCount` and that the action cannot be undone; the button stays disabled until the typed text equals the name (after trimming); on success the page goes to `HomePage` with "Tablero «nombre» borrado" announced and the fragment `#k=` removed; on error "Reintentar" is offered and nothing changes; no axe violations

### Implementation for User Story 4

- [X] T044 [US4] Implement `deleteBoard` in `packages/domain/src/use-cases/board.ts`
- [X] T045 [US4] Add `DELETE /board` (`204`) to `apps/api/src/http/routes/board.ts` and map foreign-key violations (`23503`) on `person_board_id_fkey` or `task_board_id_fkey` to `401 INVALID_LINK` in `apps/api/src/http/plugins/error-handler.ts`
- [X] T046 [US4] Add `useDeleteBoard` to `apps/web/src/api/board.ts`, create `apps/web/src/features/access/DeleteBoardDialog.tsx`, add "Borrar tablero" to the "Tablero" menu (creating the menu as in T038 if it does not exist yet), and on success call `clearAccessCode()`, clear the query cache, reset `document.title` to "TaskFlow" and show `HomePage` with the notice in `apps/web/src/app/App.tsx`
- [X] T047 [US4] Add the US4 block to `e2e/tests/boards.spec.ts`: delete the board, check the notice and that its link shows "Enlace no válido" with "Crear un tablero nuevo"

**Checkpoint**: las cuatro historias funcionan de forma independiente.

---

## Phase 7: Consola de administración (FR-119, FR-119a)

**Purpose**: listar, regenerar y borrar tableros por id desde la consola (research R23).

- [X] T048 [P] Add failing tests for `listBoards()` to `packages/domain/tests/unit/use-cases/board.test.ts` (returns `listSummaries()` ordered by creation) and implement it in `packages/domain/src/use-cases/board.ts`
- [X] T049 Add failing CLI tests to `apps/api/tests/cli/board-cli.test.ts`: `board:list` prints id, name, creation date, task and person counts and last activity, and its output never contains the 43-character code nor a hash; `board:delete --board <id> --confirm "<otro>"` does not delete and exits 1; `--confirm "<nombre exacto>"` deletes the board and its data; unknown id → "No existe ningún tablero con ese id" and exit 1; malformed id → exit 1
- [X] T050 Create `apps/api/src/cli/board-list.ts` and `apps/api/src/cli/board-delete.ts` (shows name and counts; without `--confirm` asks for the name with `node:readline/promises`; deletes only on an exact match), and add scripts `board:list` and `board:delete` to `apps/api/package.json`; then make `e2e/global-setup.ts` reuse the board named "E2E" when `board:list` shows it (code via `board:rotate --board <id>`) and create it with `board:create` only otherwise, so E2E runs do not accumulate boards

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Extend `e2e/tests/performance.spec.ts` with 100 boards in the database (created with `board:create` only up to the missing number, so repeated runs do not accumulate boards) (implemented by inserting the missing boards with SQL in `ensureBoards`, 20 tasks each, instead of up to 99 `board:create` processes) and check that SC-003 still holds for one of them (SC-106)
- [X] T052 [P] Extend `e2e/tests/security-headers.spec.ts` and `e2e/tests/access.spec.ts`: the home page and the invalid link page keep the CSP and `no-referrer`, and `public-config` returns only `boardCreationEnabled`
- [X] T053 [P] Update `README.md` and `CLAUDE.md`: several boards, web creation and its variables, console commands `board:create`/`board:list`/`board:rotate --board`/`board:delete`, decisions D12–D16, E2E setup (T018), and the repository status for feature 002 (the contract path in `CLAUDE.md` is already updated by T003)
- [X] T054 Run the manual validation of `specs/002-multiple-boards/quickstart.md` including the timing of SC-101 (scenario 1b), and record the result in `specs/002-multiple-boards/checklists/quickstart-run.md` (same format as the 001)
  - **Resultado (2026-10-18)**: secciones 1–7 ejecutadas por el asistente y SC-101 (escenario 1b) por el usuario, en menos de 60 s; registro en `checklists/quickstart-run.md`.
- [X] T055 Run `npm run lint`, `npm run lint:deps`, `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm audit --audit-level=high`; all must pass before closing the feature (constitución, definición de terminado)
- [ ] T056 Manual screen reader review (NVDA or Orca) of the new flows: create a board, copy the link, FR-103a confirmation, rename and delete (SC-107)
  - **Resultado (2026-10-18, usuario, Orca 50.3 + Firefox)**: pasos 1–3 y 5–7 OK. Paso 4 (FR-103a): Orca no anunciaba la confirmación; corregido moviendo el foco a "Cancelar" dentro del grupo etiquetado con la pregunta (y de vuelta a "Copiar enlace" al cancelar), con pruebas de regresión. Falta repetir el paso 4 con Orca sobre la corrección.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea todas las historias**. T006 → T007
  → T008 → T009; T010 → T011 → T012; T013 antes de T015; T009 antes de T015–T017.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de US1 (crea los tableros con `POST /boards`).
- **US3 (Phase 5)** y **US4 (Phase 6)**: dependen de Foundational y de la cabecera con el
  nombre (T027). El menú "Tablero" lo crea T038 (US3) y T046 (US4) le añade "Borrar tablero";
  si US4 se implementa antes, T046 crea el menú. Comparten `routes/board.ts`,
  `board-settings.test.tsx` y `App.tsx`, que se tocan en orden US3 → US4.
- **Consola (Phase 7)**: depende de Foundational (T016–T017); independiente de las historias.
- **Polish (Phase 8)**: depende de todo lo anterior.

### User Story Dependencies

- **US1 (P1)**: ninguna.
- **US2 (P1)**: US1.
- **US3 (P2)**: Foundational y T027 (cabecera con el nombre); crea el menú "Tablero" (T038).
- **US4 (P3)**: Foundational y T027 (`clearAccessCode`); usa el menú de T038 o lo crea.

### Within Each User Story

- Pruebas primero (deben fallar), luego dominio → API → web → E2E.
- Una tarea se marca `[X]` solo cuando sus pruebas se han ejecutado y pasan.

### Parallel Opportunities

- Setup: T001 y T002 en paralelo.
- Foundational: T004, T005, T010 y T013–T014 en paralelo.
- Cada historia: todas sus tareas de pruebas `[P]` en paralelo.
- Phase 7 en paralelo con US2–US4 (archivos distintos, salvo `board.test.ts`).

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (archivos distintos):
Task: "T019 integración de POST /boards y public-config en apps/api/tests/integration/boards-create.test.ts"
Task: "T020 contrato createBoard/getPublicConfig en apps/api/tests/contract/boards.contract.test.ts"
Task: "T021 pruebas web de inicio y creación en apps/web/tests/home/create-board.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T040 dominio deleteBoard en packages/domain/tests/unit/use-cases/board.test.ts"
Task: "T041 integración DELETE /board y FK en apps/api/tests/integration/board-manage.test.ts"
Task: "T042 contrato deleteBoard en apps/api/tests/contract/boards.contract.test.ts"
Task: "T043 pruebas web del borrado en apps/web/tests/access/board-settings.test.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 + Phase 2 (la instalación existente sigue funcionando con "Mi tablero").
2. US1: crear tableros desde la web.
3. US2: probar el aislamiento. **Parar y validar**: no se debe ofrecer la creación pública
   a varios equipos sin la evidencia de aislamiento de US2.

### Incremental Delivery

Un PR por fase, como en la 001: `pr/NN-002-base` (Phases 1–2), `pr/NN-002-us1-crear`,
`pr/NN-002-us2-aislamiento`, `pr/NN-002-us3-renombrar`, `pr/NN-002-us4-borrar`,
`pr/NN-002-consola`, `pr/NN-002-acabado`. Cada PR con `npm test` (y `npm run test:e2e` cuando
toque la web) en verde.

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- Las pruebas de `apps/api` comparten la PostgreSQL de pruebas (`fileParallelism: false`);
  no se ejecutan a la vez que los E2E.
- `vitest` del dominio no tiene tipos de Node: las pruebas de T005/T008 no usan `Buffer` ni
  `node:*`.
- No se toca `specs/001-kanban-task-board/tasks.md`: la 002 tiene su propia lista.
