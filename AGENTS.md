# AGENTS.md

Guía para agentes de programación (y personas) que trabajan en este repositorio. Es la única
fuente de instrucciones de agente: `CLAUDE.md` solo la importa para Claude Code. Si cambias algo
que aquí se describe (comandos, arquitectura, estado de una funcionalidad), actualiza este archivo
en el mismo cambio.

## Estado del repositorio

TaskFlow (tableros kanban compartidos para equipos pequeños) se implementa por funcionalidades
con Spec Kit, por fases y pruebas primero; las tareas hechas están marcadas `[X]`:

- `specs/001-kanban-task-board/` (T001–T152): el tablero. Implementada; solo queda T134 (validación
  manual con lector de pantalla). Decisiones D1–D11 de su `plan.md`.
- `specs/002-multiple-boards/` (T001–T057): varios tableros (uno por equipo), creación desde la
  web, nombre, borrado definitivo y consola de administración. Implementada y validada (incluidas
  las pruebas manuales T054 y T056). Decisiones D12–D16 de su `plan.md`
  (D12 sustituye a D4 de la 001); riesgo aceptado de ids globales en su `research.md` (R27).
- `specs/003-neobrutalism-ui/` (T001–T023): estilo visual neobrutalista de la web (solo
  presentación, claro y oscuro). Implementada; solo queda T023 (validación manual de su
  `quickstart.md`, con una comprobación previa automatizada anotada en la tarea). Decisiones
  D17–D18 de su `plan.md`; valores y contrastes en su `contracts/ui-tokens.md`.

Entregas (Git):

- Cada fase de una funcionalidad se entrega en una rama `pr/NN-<feature>-<fase>` desde `main`
  (p. ej., `pr/25-003-us1-base-visual`), con **un commit por capa** que cite sus tareas
  (`feat(web): … (T008–T009)`, `test(e2e): … (T005–T007)`, `docs(003): marcar T005–T010`);
  nunca un único commit con todo.
- Un defecto se corrige en una rama `fix/NN-<resumen>` ligada al issue `#NN`: primero se
  documenta el caso en la `spec.md` afectada y se añaden tareas nuevas al final de su `tasks.md`
  (una prueba que reproduce el defecto y **debe fallar antes** de la corrección, y la corrección),
  luego un commit por paso citando `(TNNN, #NN)`. Ejemplo: T151–T152 de la 001 (#29).
- Mensajes con prefijo convencional (`feat`, `fix`, `test`, `docs`, `build`, …) y ámbito
  (`web`, `api`, `domain`, `contracts`, `e2e`, `001`, `002`, `003`).
- No hagas commits, ramas ni push si no te lo piden.

Idioma: la documentación, los textos de la UI y los mensajes de commit están en español.

## Flujo de trabajo (Spec Kit)

Fuente de verdad, en orden de autoridad:

1. `.specify/memory/constitution.md` — reglas no negociables. Las más operativas:
   - No declarar una tarea terminada si sus pruebas fallan o no se ejecutaron.
   - Toda decisión que afecte a la arquitectura o a la seguridad se **explica y se espera
     aprobación del usuario antes de aplicarla**. Las decisiones D1–D11 (001), D12–D16 (002) y
     D17–D18 (003) ya están aprobadas (2026-10-17); cualquier decisión nueva o desviación
     requiere aprobación.
   - Cambios de esquema solo mediante migraciones versionadas con `up`/`down`.
2. `specs/<feature>/spec.md` — requisitos (FR-###, SC-###) y clarificaciones. La 002 amplía la
   001 y sustituye explícitamente FR-001 (tablero único) y la entidad Tablero.
3. `plan.md`, `research.md` (decisiones R1–R17 con alternativas), `data-model.md`,
   `contracts/openapi.yaml`, `quickstart.md` (validación manual). El contrato **vigente** es
   `specs/002-multiple-boards/contracts/openapi.yaml` (1.1.0, copia completa del de la 001 más
   los cambios); las pruebas de contrato lo cargan desde esa ruta.
4. `tasks.md` — marcar `[x]` solo cuando la tarea y sus pruebas pasan.

Comandos de Spec Kit: `speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`,
`speckit-analyze`, `speckit-implement`, `speckit-checklist`, `speckit-converge`. Están
instalados como skills de Claude Code en `.claude/skills/speckit-*/SKILL.md`; cualquier otro
agente puede seguir las mismas instrucciones leyendo ese `SKILL.md`. Los scripts que usan están
en `.specify/scripts/bash/` y las plantillas en `.specify/templates/`. `.specify/feature.json`
es estado local (ignorado por git).

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
- **Estilo** (D18): colores, bordes, sombras, radios, tipografía y movimiento solo en
  `apps/web/src/ui/tokens.css`; el resto de hojas usa `var(--…)`. `apps/web/tests/ui/tokens.test.ts`
  comprueba los contrastes de `specs/003-neobrutalism-ui/contracts/ui-tokens.md` y rechaza
  colores literales fuera de `tokens.css`. La tipografía (Space Grotesk, D17) se autoaloja con
  `@fontsource-variable/space-grotesk`: no uses CDNs de fuentes (CSP `'self'`).

Comportamientos transversales que no se deducen de un solo archivo:

- **Acceso sin login**: enlace secreto `/#k=<código>` (256 bits, base64url). El código va en el
  fragmento para que nunca llegue a logs ni a `Referer`; la web lo envía como
  `Authorization: Bearer`. En BD solo se guarda su SHA-256. Cualquier código inválido produce
  el mismo `401 INVALID_LINK`. El código nunca debe aparecer en errores, logs ni cabeceras.
  Cada código abre exactamente un tablero; todo repositorio filtra por `board_id`.
- **Rutas públicas** (D16): `GET /v1/public-config` y `POST /v1/boards` viven en un ámbito
  hermano del autenticado en `apps/api/src/http/app.ts`; el resto de `/v1` pasa por el plugin
  de auth. No leen ni modifican tableros existentes (excepción justificada en el plan de la 002).
- **Crear tablero** (D12, D13): límite de creaciones nuevas por IP y hora en memoria e
  interruptor `BOARD_CREATION_ENABLED`. El servidor genera el código y solo lo devuelve en el
  `201`; una repetición con el mismo id y nombre da `200` sin código (la web avisa).
- **Borrar tablero** (D14): físico e inmediato, en cascada. Un `BOARD_NOT_FOUND` o una violación
  de FK de `board_id` (escritura en vuelo) se responden como `401 INVALID_LINK`.
- **Cambiar de tablero en la web**: `App.tsx` vacía la caché y vuelve a montar el tablero con
  cada código (pegar otro enlace no debe mostrar datos del anterior).
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
npm run format                         # Prettier sobre todo el repositorio

# Fuera de Compose (pasos completos en README.md, «Arranque»):
docker compose up -d --wait db         # sin --wait, la migración falla si la BD aún no está lista
set -a; . ./.env; set +a               # la API no lee .env por sí sola; en cada terminal
export TRUST_PROXY=127.0.0.1,::1       # confiar en el proxy de Vite
npm run dev -w apps/api                # API con recarga (tsx watch) en :3000
npm run dev -w apps/web                # web con Vite en :5173; reenvía /api a API_PROXY_TARGET

npm run db:migrate -w apps/api         # aplicar migraciones
npm run db:migrate:down -w apps/api    # revertir una
npm run board:create -w apps/api -- --name "<nombre>"   # crear un tablero (imprime el enlace)
npm run board:list -w apps/api                          # tableros con id, recuentos y actividad
npm run board:rotate -w apps/api -- --board <id>        # regenerar el enlace si se pierde
npm run board:delete -w apps/api -- --board <id>        # borrar (pide el nombre o --confirm)
```

La CI (`.github/workflows/ci.yml`, en cada push y PR) ejecuta `npm ci`, `lint`, `lint:deps`,
`typecheck`, `npm test` (con PostgreSQL 17 en el puerto 5433) y `npm audit --audit-level=high`;
los E2E no se ejecutan en CI, así que lánzalos en local si tocas la web. Antes de dar por
terminado un cambio, pasa esos mismos comandos.

No pases `-w` a `npx vitest`: vitest lo interpreta como `--watch` y el proceso se queda esperando
indefinidamente. Selecciona el paquete con `npm test -w <paquete> -- <argumentos de vitest>`.

Las pruebas de `apps/api` usan una PostgreSQL real compartida (`TEST_DATABASE_URL`) y se
ejecutan con `fileParallelism: false`; no las paralelices entre archivos.

Los E2E levantan su propia API (puerto 3100) y web (5174) contra `db-test`, migran y obtienen el
código del tablero "E2E" (lo reutilizan con `board:list` + `board:rotate --board`, o lo crean con
`board:create`; guardado en `e2e/.auth/`, ignorado por git) y vacían tareas y personas antes de
cada prueba. `boards.spec.ts` crea tableros reales desde la web. No los ejecutes a la vez que las pruebas de `apps/api` (misma base de
datos). Con `E2E_BASE_URL` + `E2E_ACCESS_CODE` se ejecutan contra un entorno ya arrancado.

Paquetes TypeScript sin compilar: `domain` y `contracts` exportan `src/index.ts`; la API se
ejecuta con `tsx` y la web con Vite (`moduleResolution: Bundler`). Las migraciones se registran a
mano en `apps/api/src/persistence/migrations/index.ts`. `vitest` en `packages/domain` no tiene
tipos de Node: las pruebas del dominio no pueden usar `Buffer` ni `node:*`.
