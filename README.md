# TaskFlow

Tableros kanban compartidos para equipos pequeños, uno por equipo en la misma instalación:
tareas en tres columnas (Pendiente, En progreso, Hecha), asignación a personas del equipo,
búsqueda y filtros, edición y borrado con "Deshacer". Sin cuentas de usuario: cada tablero se
abre con su enlace secreto, y cualquiera puede crear uno nuevo desde la pantalla de inicio. La
interfaz está en español, tiene un estilo neobrutalista con modo claro y oscuro (según el
sistema), es accesible (WCAG 2.1 AA) y funciona desde 320 px de ancho.

Especificación, plan y tareas por funcionalidad:

- [`specs/001-kanban-task-board/`](specs/001-kanban-task-board/): el tablero (guía de arranque y
  validación en su [`quickstart.md`](specs/001-kanban-task-board/quickstart.md)).
- [`specs/002-multiple-boards/`](specs/002-multiple-boards/): varios tableros, nombre y borrado
  (validación en su [`quickstart.md`](specs/002-multiple-boards/quickstart.md)). Su
  `contracts/openapi.yaml` es el contrato vigente de la API.
- [`specs/003-neobrutalism-ui/`](specs/003-neobrutalism-ui/): estilo visual neobrutalista, claro y
  oscuro (valores y contrastes en su
  [`contracts/ui-tokens.md`](specs/003-neobrutalism-ui/contracts/ui-tokens.md)).

Las reglas del proyecto están en la
[constitución](.specify/memory/constitution.md).

## Requisitos

- Docker con Docker Compose v2.
- Node.js 24 y npm (para desarrollar y ejecutar las pruebas fuera de los contenedores).

## Arranque

```bash
cp .env.example .env      # valores locales; .env nunca se sube al repositorio
npm ci
docker compose up --build
```

El servicio `migrate` aplica las migraciones y, la primera vez, crea "Mi tablero" e imprime **una
sola vez** su enlace (`http://localhost:5173/#k=…`). La web queda en <http://localhost:5173>,
donde se pueden crear más tableros, y la API en <http://localhost:3000/api/health>.

Para desarrollar con recarga en caliente fuera de los contenedores, arranca solo la base de datos
y ejecuta la API y la web con Node. La API no lee `.env` por sí sola: exporta sus variables en
cada terminal.

```bash
docker compose up -d --wait db            # --wait: espera a que PostgreSQL acepte conexiones
set -a; . ./.env; set +a                  # en cada terminal
export TRUST_PROXY=127.0.0.1,::1          # la API confía en el proxy de Vite (IP real del cliente)
npm run db:migrate -w apps/api
npm run board:init -w apps/api            # la primera vez: crea "Mi tablero" e imprime su enlace
npm run dev -w apps/api                   # terminal 1: API en :3000
npm run dev -w apps/web                   # terminal 2: web en :5173, reenvía /api a la API
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de dominio, contratos, API (contra PostgreSQL de pruebas) y web |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright (escritorio y 320 px, con axe) |
| `npm run lint` / `npm run lint:deps` / `npm run typecheck` | Lint, límites entre paquetes y tipos |
| `npm run format` | Formatear con Prettier |
| `npm run dev -w apps/api` / `npm run dev -w apps/web` | API y web con recarga, fuera de Compose |
| `npm run db:migrate -w apps/api` / `npm run db:migrate:down -w apps/api` | Aplicar / revertir una migración |
| `npm run board:init -w apps/api` | Crear "Mi tablero" si la instalación no tiene ninguno |
| `npm run board:create -w apps/api -- --name "<nombre>"` | Crear un tablero e imprimir su enlace una vez |
| `npm run board:list -w apps/api` | Listar los tableros: id, nombre, creación, tareas, personas y última actividad (sin códigos) |
| `npm run board:rotate -w apps/api -- --board <id>` | Regenerar el enlace de un tablero (`--board` es obligatorio si hay varios) |
| `npm run board:delete -w apps/api -- --board <id>` | Borrar un tablero con sus datos tras escribir su nombre (o `--confirm "<nombre>"`) |

Antes de `npm test` o `npm run test:e2e` hay que arrancar la base de datos de pruebas con
`docker compose up -d db-test`; los E2E necesitan además `npx playwright install chromium`
(una vez, desde `e2e/`). No ejecutes ambas suites a la vez: comparten esa base de datos.

La integración continua (GitHub Actions) ejecuta en cada push y pull request el lint, los
límites entre paquetes, los tipos, `npm test` y `npm audit`; los E2E se ejecutan en local.

## Estructura

```text
packages/domain      reglas de negocio y casos de uso, sin dependencias ni E/S
packages/contracts   esquemas Zod de la API, compartidos por la API y la web
apps/api             API REST (Fastify + Kysely + PostgreSQL 17), migraciones y CLI
apps/web             interfaz React 19 (Vite, TanStack Query, dnd-kit); estilos en src/ui/tokens.css
e2e                  pruebas de extremo a extremo (Playwright)
specs                especificación, plan, contratos y tareas de cada funcionalidad (Spec Kit)
```

## Colaborar

El proyecto se desarrolla con [Spec Kit](https://github.com/github/spec-kit): cada
funcionalidad parte de una especificación, un plan y una lista de tareas en `specs/`, y se
implementa con las pruebas primero. Toda corrección de un defecto incluye una prueba que lo
reproduce. La documentación, los textos de la interfaz y los mensajes de commit van en español.

Si usas un agente de programación, [`AGENTS.md`](AGENTS.md) reúne las instrucciones del
repositorio: estado de cada funcionalidad, arquitectura, convenciones de ramas y commits, y
comportamientos que no se deducen de un solo archivo.

## Seguridad

- **El enlace es la llave del tablero.** Cualquiera que lo tenga puede ver, editar, renombrar y
  **borrar el tablero entero sin vuelta atrás**. Compártelo solo con tu equipo. Cada enlace abre
  un único tablero; los datos de un tablero nunca se ven desde otro.
- Si se filtra, regenéralo desde **Compartir → Regenerar enlace**: el anterior deja de funcionar
  al instante. Si se pierde, búscalo con `board:list` y regenéralo desde el servidor:
  `docker compose run --rm migrate npm run board:rotate -w apps/api -- --board <id>`.
- **Cualquiera que llegue a la web puede crear tableros.** Se limita a
  `BOARD_CREATION_PER_HOUR` tableros nuevos por IP y hora (10 por defecto) y se puede desactivar
  con `BOARD_CREATION_ENABLED=false`; los tableros se siguen pudiendo crear por consola.
- El código del enlace va en el fragmento de la URL (`#k=…`), que el navegador no envía al
  servidor; en la base de datos solo se guarda su hash.
- Límites de peticiones por IP configurables con `RATE_LIMIT_*` (ver `.env.example`); no se
  pueden desactivar.
- Detrás de un proxy, la API solo acepta `X-Forwarded-For` de las IP o rangos de `TRUST_PROXY`
  (Compose fija la IP del contenedor web), para que los límites por IP distingan clientes.
- **Pendiente antes de un uso real**: copias de seguridad de la base de datos (con el borrado
  definitivo de tableros, son la única forma de recuperar datos), HTTPS y alojamiento.
