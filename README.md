# TaskFlow

Tablero kanban compartido para equipos pequeños: tareas en tres columnas (Pendiente, En
progreso, Hecha), asignación a personas del equipo, búsqueda y filtros, edición y borrado con
"Deshacer". Sin cuentas de usuario: se accede con un enlace secreto. La interfaz está en español,
es accesible (WCAG 2.1 AA) y funciona desde 320 px de ancho.

La especificación, el plan y las tareas están en
[`specs/001-kanban-task-board/`](specs/001-kanban-task-board/); la guía de arranque y
validación completa, en [`quickstart.md`](specs/001-kanban-task-board/quickstart.md).

## Requisitos

- Docker con Docker Compose v2.
- Node.js 24 y npm (para desarrollar y ejecutar las pruebas fuera de los contenedores).

## Arranque

```bash
cp .env.example .env      # valores locales; .env nunca se sube al repositorio
npm ci
docker compose up --build
```

El servicio `migrate` aplica las migraciones y, la primera vez, imprime **una sola vez** el
enlace del tablero (`http://localhost:5173/#k=…`). La web queda en <http://localhost:5173> y la
API en <http://localhost:3000/api/health>.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de dominio, contratos, API (contra PostgreSQL de pruebas) y web |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright (escritorio y 320 px, con axe) |
| `npm run lint` / `npm run lint:deps` / `npm run typecheck` | Lint, límites entre paquetes y tipos |
| `npm run db:migrate -w apps/api` / `npm run db:migrate:down -w apps/api` | Aplicar / revertir una migración |
| `npm run board:init -w apps/api` / `npm run board:rotate -w apps/api` | Crear el tablero / regenerar el enlace |

Antes de `npm test` o `npm run test:e2e` hay que arrancar la base de datos de pruebas con
`docker compose up -d db-test`; los E2E necesitan además `npx playwright install chromium`
(una vez, desde `e2e/`). No ejecutes ambas suites a la vez: comparten esa base de datos.

## Estructura

```text
packages/domain      reglas de negocio y casos de uso, sin dependencias ni E/S
packages/contracts   esquemas Zod de la API, compartidos por la API y la web
apps/api             API REST (Fastify + Kysely + PostgreSQL), migraciones y CLI
apps/web             interfaz React (Vite, TanStack Query, dnd-kit)
e2e                  pruebas de extremo a extremo (Playwright)
```

## Seguridad

- **El enlace es la llave del tablero.** Cualquiera que lo tenga puede ver, editar y borrar
  todo. Compártelo solo con tu equipo.
- Si se filtra, regenéralo desde **Compartir → Regenerar enlace**: el anterior deja de funcionar
  al instante. Si se pierde, regenéralo desde el servidor:
  `docker compose run --rm migrate npm run board:rotate -w apps/api`.
- El código del enlace va en el fragmento de la URL (`#k=…`), que el navegador no envía al
  servidor; en la base de datos solo se guarda su hash.
- Límites de peticiones por IP configurables con `RATE_LIMIT_*` (ver `.env.example`); no se
  pueden desactivar.
- **Pendiente antes de un uso real**: copias de seguridad de la base de datos, HTTPS y
  alojamiento (fuera del alcance de esta versión). Detrás de un proxy, los límites por IP aún
  no distinguen clientes (tarea T135 de `tasks.md`).
