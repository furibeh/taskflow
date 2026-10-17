# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

TaskFlow (tablero kanban compartido para equipos pequeños) se implementa por fases siguiendo
`specs/001-kanban-task-board/tasks.md` (T001–T134, por historia de usuario, pruebas primero;
las tareas hechas están marcadas `[X]`). Implementadas todas las fases (US1–US6, acabado y
convergencia); solo queda la revisión manual con lector de pantalla de T134. Rama de trabajo:
`001-kanban-task-board`. Decisiones de arquitectura/seguridad aprobadas: D1–D11 de `plan.md`.

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
- **Límites por IP detrás del proxy**: la API solo acepta `X-Forwarded-For` de las IP/CIDR de
  `TRUST_PROXY` (Compose fija la IP del contenedor web). No uses `trustProxy: true` ni saltos.
- **Arrastrar y soltar**: dnd-kit para ratón/táctil; el teclado usa un modo propio en el asa
  "Mover «título»" (no el `KeyboardSensor`). Todas las vías llaman a `useMoveTask`, que vive en
  el tablero para que sus avisos no se pierdan al desmontarse la tarjeta.

## Comandos (definidos en el plan)

```bash
cp .env.example .env && npm ci
docker compose up --build              # db, migrate (migraciones + board:init), api :3000, web :5173
docker compose up -d db-test           # PostgreSQL de pruebas (puerto 5433), necesario para npm test

npm test                               # dominio + contracts + API + web
npm test -w packages/domain            # un solo paquete
npm test -w apps/api -- <ruta/al/archivo.test.ts>   # un solo archivo (ruta relativa al paquete)
npm test -w packages/domain -- -t "<nombre del test>"
npm run test:e2e                       # Playwright (desktop y mobile-320, con axe); requiere db-test
npx playwright install chromium        # una vez, desde e2e/
npm run lint && npm run lint:deps && npm run typecheck

npm run db:migrate -w apps/api         # aplicar migraciones
npm run db:migrate:down -w apps/api    # revertir una
npm run board:rotate -w apps/api       # regenerar el enlace si se pierde
```

No pases `-w` a `npx vitest`: vitest lo interpreta como `--watch` y el proceso se queda esperando
indefinidamente. Selecciona el paquete con `npm test -w <paquete> -- <argumentos de vitest>`.

Las pruebas de `apps/api` usan una PostgreSQL real compartida (`TEST_DATABASE_URL`) y se
ejecutan con `fileParallelism: false`; no las paralelices entre archivos.

Los E2E levantan su propia API (puerto 3100) y web (5174) contra `db-test`, migran y obtienen un
código con `board:rotate` (guardado en `e2e/.auth/`, ignorado por git) y vacían tareas y personas
antes de cada prueba. No los ejecutes a la vez que las pruebas de `apps/api` (misma base de
datos). Con `E2E_BASE_URL` + `E2E_ACCESS_CODE` se ejecutan contra un entorno ya arrancado.

Paquetes TypeScript sin compilar: `domain` y `contracts` exportan `src/index.ts`; la API se
ejecuta con `tsx` y la web con Vite (`moduleResolution: Bundler`). Las migraciones se registran a
mano en `apps/api/src/persistence/migrations/index.ts`. `vitest` en `packages/domain` no tiene
tipos de Node: las pruebas del dominio no pueden usar `Buffer` ni `node:*`.
