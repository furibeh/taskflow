# Research: Tablero Kanban de Tareas (TaskFlow v1)

**Fecha**: 2026-10-17 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Restricciones fijadas por el usuario: React + TypeScript (frontend), Node.js + TypeScript
(backend), PostgreSQL, API REST validada con esquemas, pruebas automatizadas de dominio y API,
ejecución local con Docker Compose. Cada decisión sigue el formato Decisión / Justificación /
Alternativas. Las marcadas con **[ARQ]** o **[SEG]** afectan a arquitectura o seguridad y,
según la constitución, requieren aprobación explícita antes de implementarse.

---

## R1. Organización del repositorio **[ARQ]**

- **Decisión**: monorepo con *npm workspaces*: `packages/domain`, `packages/contracts`,
  `apps/api`, `apps/web`, y `e2e/` para pruebas extremo a extremo.
- **Justificación**: el dominio debe ser independiente de la interfaz (Principio II) y
  compartible; un paquete propio hace que esa independencia la verifique el compilador (el
  paquete `domain` no declara dependencias de React, Fastify ni PostgreSQL). Los esquemas de
  la API se comparten entre cliente y servidor sin duplicarse. npm workspaces viene con Node;
  no añade herramientas.
- **Alternativas**: dos repositorios separados (duplica esquemas, complica versionado);
  pnpm/Turborepo/Nx (más potentes pero innecesarios para 4 paquetes); un único paquete con
  carpetas (no impide importar UI desde el dominio).

## R2. Capas y límites **[ARQ]**

- **Decisión**: arquitectura hexagonal ligera.
  - `domain`: entidades, objetos valor, reglas de validación, casos de uso y *puertos*
    (interfaces de repositorio, reloj, generador de códigos). Sin E/S.
  - `contracts`: esquemas HTTP (DTOs de petición/respuesta y errores) con Zod.
  - `api`: adaptadores de entrada (rutas HTTP) y de salida (repositorios PostgreSQL),
    composición y configuración.
  - `web`: interfaz; solo conoce `contracts` y el cliente HTTP; nunca importa `api`.
- **Regla de dependencias**: `web → contracts → domain` y `api → contracts, domain`.
  `domain` no depende de nadie. Se verifica en CI con `dependency-cruiser`.
- **Justificación**: cumple los Principios I y II; los casos de uso se prueban con
  repositorios en memoria sin levantar HTTP ni base de datos.
- **Alternativas**: MVC clásico con servicios en el backend (la lógica tiende a filtrarse a
  controladores); DDD completo con agregados y eventos (excesivo para el alcance).

## R3. Runtime y lenguaje

- **Decisión**: Node.js 24 LTS, TypeScript 5.x en modo `strict`, módulos ES.
- **Justificación**: versión LTS vigente; una sola versión de lenguaje en todo el monorepo.
- **Alternativas**: Node 22 (LTS de mantenimiento; válido pero con menor vida útil).

## R4. Framework HTTP

- **Decisión**: Fastify 5 con `fastify-type-provider-zod`.
- **Justificación**: validación de entrada y serialización de salida por esquema integradas
  (requisito "API REST validada mediante esquemas"); tipos inferidos de los mismos esquemas
  Zod que usa el frontend; `app.inject()` permite pruebas de API sin abrir puertos; buen
  ecosistema (`@fastify/helmet`, `@fastify/rate-limit`, `@fastify/swagger`).
- **Alternativas**: Express + middleware Zod (validación manual en cada ruta, sin
  serialización por esquema); NestJS (mucha ceremonia y decoradores para un API pequeño);
  Hono (válido, ecosistema de plugins más reducido en Node).

## R5. Esquemas y validación **[SEG]**

- **Decisión**: validación en dos niveles.
  1. **Frontera HTTP** (`contracts`, Zod): forma, tipos, longitudes, enumerados, UUIDs;
     objetos estrictos (campos desconocidos → 400). Fastify valida *body*, *params*,
     *querystring* y cabeceras antes de llegar al manejador.
  2. **Dominio**: invariantes (título 1–200 caracteres tras normalizar, nombre único,
     responsable existente, ventana de deshacer). Devuelve errores de dominio tipados.
  - Las constantes (`TITLE_MAX = 200`, etc.) viven en `domain` y `contracts` las reutiliza,
    de modo que ambos niveles nunca divergen.
  - La validación en el cliente reutiliza los mismos esquemas, solo para dar respuesta
    inmediata; el servidor siempre revalida.
- **Normalización de texto**: `trim()` + normalización Unicode NFC; las longitudes se miden
  en *code points* (`[...s].length`), coherente con `char_length` de PostgreSQL. Así un emoji
  cuenta como 1 carácter.
- **Justificación**: Principio III; mismo mensaje y límites en todos los niveles.
- **Alternativas**: JSON Schema/TypeBox (buena integración Fastify, pero peor ergonomía para
  reutilizar en React y para reglas transformadoras como `trim`); validar solo en dominio
  (errores de forma llegarían tarde y sin estructura).

## R6. Acceso a datos y migraciones

- **Decisión**: Kysely (constructor de consultas tipado) sobre `pg`, con el *Migrator* de
  Kysely; migraciones en TypeScript con `up` y `down`, numeradas, en
  `apps/api/src/persistence/migrations/`.
- **Justificación**: SQL explícito y tipado sin ORM pesado; migraciones versionadas y
  reversibles (Principio VI); los repositorios implementan los puertos del dominio, de modo
  que el dominio no conoce Kysely.
- **Alternativas**: Prisma (motor binario, migraciones declarativas difíciles de revisar,
  modelos acoplados al cliente generado); Drizzle (válido; Kysely elegido por su modelo de
  migraciones explícitas `up/down`); `node-pg-migrate` + SQL crudo (sin tipos en consultas).

## R7. Acceso por enlace secreto **[SEG]**

- **Decisión**:
  - Código de acceso: 32 bytes aleatorios (`crypto.randomBytes`, 256 bits) codificados en
    base64url (43 caracteres). Supera los 128 bits exigidos por FR-028a.
  - Se guarda solo su **hash SHA-256** en la tabla `board`; nunca el código en claro. Al ser
    un secreto de alta entropía, un hash rápido es suficiente (no requiere bcrypt/argon2).
  - El enlace tiene la forma `https://<host>/#k=<código>`. El código va en el **fragmento**
    (`#`), que el navegador no envía al servidor, no aparece en logs de acceso ni en la
    cabecera `Referer` (FR-028d). El frontend lo lee y lo envía en cada petición como
    `Authorization: Bearer <código>`.
  - El backend resuelve el tablero por `hash(código)`; si no coincide responde `401
    INVALID_LINK` genérico, idéntico para "no existe" y "código incorrecto" (FR-028c).
  - Regenerar (FR-028b) sustituye el hash en una única sentencia; el código anterior deja de
    funcionar en la siguiente petición. El nuevo código se devuelve una sola vez.
  - Los logs redactan la cabecera `Authorization`. `Referrer-Policy: no-referrer`.
  - Primer enlace: comando `npm run board:init -w apps/api` (también ejecutado por Docker
    Compose en el arranque) que crea el tablero si no existe e imprime el enlace por consola
    **una sola vez**. `board:rotate` permite recuperar el acceso si se pierde el enlace
    (requiere acceso al servidor, no al tablero).
- **Riesgo aceptado** (spec): quien posea el enlace vigente tiene acceso total.
- **Alternativas**: código en la ruta o *query string* (queda en logs, historial e
  intermediarios); cookie de sesión tras visitar el enlace (añade CSRF y gestión de sesión
  sin necesidad); contraseña de equipo (rechazada en la clarificación).

## R8. Protección frente a abuso **[SEG]**

- **Decisión**:
  - `@fastify/rate-limit` por IP: 300 peticiones/min en total y 60 escrituras/min; las
    respuestas `401` cuentan contra un límite de 20/min por IP para frenar fuerza bruta.
  - Los tres valores se configuran con `RATE_LIMIT_GLOBAL`, `RATE_LIMIT_WRITES` y
    `RATE_LIMIT_UNAUTHORIZED` (por defecto 300/60/20). Se pueden subir (los E2E usan valores
    holgados), pero **nunca desactivar**: el mínimo es 1 y la API no arranca con `0` u otros
    valores no numéricos. Decidido por el usuario el 2026-10-17 (opción A), en lugar de un
    interruptor que los apagara.
  - **IP real detrás del proxy (D11)**: el proxy de la web añade `X-Forwarded-For` y la API
    solo lo acepta si la conexión llega desde una IP/CIDR de `TRUST_PROXY` (en Compose, la IP
    fija `172.28.0.10` del contenedor web). Sin ello, todos los usuarios compartían la IP del
    proxy y 20 fallos de cualquiera bloqueaban a todo el equipo. Alternativas descartadas:
    confiar en cualquier `X-Forwarded-For` o en N saltos (suplantable por quien se conecte
    directamente a la API) y no bloquear códigos válidos tras fallos (seguiría compartiendo
    los límites).
  - `@fastify/helmet` con CSP estricta (`default-src 'self'`), `X-Content-Type-Options`,
    `frame-ancestors 'none'`.
  - Tamaño máximo de cuerpo: 16 KiB.
  - Todo texto de usuario se renderiza como texto con React (sin `dangerouslySetInnerHTML`;
    regla de lint que lo prohíbe) → cubre FR-010.
- **Copias de seguridad**: fuera del alcance de la ejecución local. Se documenta como
  requisito de despliegue (feature futura): `pg_dump` diario, retención de 7 días,
  restauración manual por quien opera el servidor.
- **Alternativas**: CAPTCHA (fricción excesiva para un equipo pequeño); WAF externo
  (depende del despliegue, no aplica en local).

## R9. Borrado con "Deshacer" **[ARQ]**

- **Decisión**: borrado lógico con columna `deleted_at`.
  - `DELETE /tasks/:id` marca `deleted_at = now()` y responde con `undoUntil`.
  - `POST /tasks/:id/restore` limpia `deleted_at` si `now() - deleted_at ≤ 15 s`; si no,
    `410 UNDO_EXPIRED`. La interfaz ofrece la acción durante 10 s (spec); el servidor admite
    5 s de margen para la latencia de red.
  - Todas las consultas excluyen filas con `deleted_at` no nulo.
  - Un proceso periódico en la API (cada 60 s) elimina físicamente las tareas borradas hace
    más de 15 s, para que el borrado sea realmente definitivo. Todas las marcas de tiempo del
    borrado (`deleted_at`, ventana de restauración, purga) salen del `Clock` del dominio, nunca
    de `now()` en SQL, para que las pruebas sean deterministas.
  - La interfaz desactiva "Deshacer" a los 10 s aunque el aviso tenga el foco; nunca ofrece
    una restauración que el servidor vaya a rechazar.
  - FR-013d (responsable eliminado durante la ventana) se cumple con la clave foránea
    `ON DELETE SET NULL`, que también afecta a las tareas borradas lógicamente.
- **Alternativas**: retrasar el borrado en el cliente 10 s antes de enviarlo (se pierde si el
  usuario cierra la página y los demás siguen viendo la tarea); tabla de papelera separada
  (más código para el mismo resultado).

## R10. Duplicados y reintentos (FR-011, FR-021a)

- **Decisión**: el cliente genera el UUID de las entidades nuevas (`id` en el cuerpo de
  `POST /tasks` y `POST /people`). Si llega un `id` que ya existe con los mismos datos se
  devuelve `200` con la entidad existente (repetición idempotente); con datos distintos,
  `409 ID_CONFLICT`. `PATCH` y `DELETE` son idempotentes por naturaleza.
- **Justificación**: un reintento tras un tiempo de espera agotado (la petición pudo haberse
  guardado) nunca crea duplicados. Más simple que una tabla de claves de idempotencia.
- **Alternativas**: cabecera `Idempotency-Key` con almacenamiento aparte; deshabilitar el
  botón solo en cliente (no cubre reintentos tras timeout).

## R11. Concurrencia

- **Decisión**: "gana el último guardado" (spec). Sin control de versiones optimista en v1.
  Las operaciones sobre una tarea inexistente o borrada devuelven `404 TASK_NOT_FOUND` y la
  interfaz recarga el tablero.
- **Alternativas**: `ETag`/`If-Match` con `409` en conflicto (más robusto; se deja como mejora
  si aparecen pérdidas de cambios reales).

## R12. Búsqueda y filtros

- **Decisión**: filtrado en el servidor: `GET /tasks?assignee=&status=&q=`.
  - Búsqueda insensible a mayúsculas y tildes con la extensión `unaccent` de PostgreSQL:
    `unaccent(lower(title)) LIKE '%' || unaccent(lower($q)) || '%'` sobre título y
    descripción, escapando `%`, `_` y `\` para que el texto sea literal (FR-024b).
  - Sin índices de texto: con cientos de tareas un recorrido secuencial está muy por debajo
    del objetivo de 1 s (SC-003). Se revisará si el volumen crece.
  - La persistencia de filtros (FR-027) es preferencia del dispositivo: `localStorage` en el
    cliente, envuelto en `try/catch`.
- **Justificación**: una única implementación de la regla de coincidencia, en el servidor.
- **Alternativas**: descargar todo y filtrar en el cliente (duplicaría la regla de tildes en
  la UI, contra el Principio II); búsqueda de texto completo (`tsvector`, no hace coincidencia
  por subcadena y es innecesaria a esta escala).

## R13. Frontend

- **Decisión**: React 19 + Vite, TanStack Query para el estado del servidor, React Router
  solo si hace falta más de una vista (tablero + panel de personas como diálogo → no se
  necesita en v1), CSS Modules con variables CSS.
  - **Mutaciones pesimistas** (clarificación): el tablero se actualiza tras la respuesta del
    servidor (`onSuccess` → invalidar consulta); estado "Guardando…" mientras `isPending`.
  - Cliente HTTP propio sobre `fetch` con `AbortController` a 10 s (FR-021a), que valida las
    respuestas con los esquemas de `contracts`.
  - Componentes accesibles: diálogo nativo `<dialog>`, `<select>` nativo para estado y
    responsable, región `aria-live="polite"` para anuncios y `role="alert"` para errores.
  - **Arrastrar y soltar con `@dnd-kit/core`** (añadido a petición del usuario, FR-019a):
    sensores de puntero, táctil (activación tras 250 ms) y teclado (Espacio/flechas/Escape);
    anuncios para lectores de pantalla traducidos al español; columnas como zonas de soltado.
    Al soltar se ejecuta la misma mutación pesimista que el `<select>` de estado: la tarjeta
    no se mueve hasta que el servidor confirma. Solo se activa con las tres columnas visibles
    (≥ 768 px); en pestañas móviles queda el control explícito, que se mantiene siempre.
    - *Alternativas*: API nativa HTML5 de drag and drop (no funciona en táctil ni con
      teclado; habría que reimplementar ambos); `react-beautiful-dnd` (archivado, sin
      mantenimiento); `@hello-pangea/dnd` (sucesor mantenido, pero orientado a listas
      ordenables y más pesado; aquí no hay reordenación dentro de columnas); `pragmatic-drag-
      and-drop` (ligero, pero deja la accesibilidad por teclado a cargo de la aplicación).
  - Móvil (< 768 px): columnas como pestañas accesibles (`role="tablist"`) con contador;
    ≥ 768 px: tres columnas lado a lado.
- **Alternativas**: Redux/Zustand (innecesario: casi todo el estado es del servidor);
  Tailwind o librerías de componentes (más peso; los controles nativos ya son accesibles);
  Next.js (SSR innecesario para una herramienta interna).

## R14. Manejo de errores

- **Decisión**: formato *Problem Details* (RFC 9457, `application/problem+json`) con un
  `code` estable y, en validación, una lista `errors[]` por campo. Detalle en
  [contracts/openapi.yaml](./contracts/openapi.yaml).
  - El dominio devuelve errores tipados (`Result<T, DomainError>`); un único manejador de
    errores de Fastify los traduce a HTTP. Errores no previstos → `500 INTERNAL_ERROR` con
    mensaje genérico y un `requestId`; la traza solo va al log.
  - El frontend traduce `code` → mensaje en español; el `message` del servidor solo se usa
    como respaldo.
- **Alternativas**: excepciones de dominio (flujo de control implícito, más difícil de
  probar exhaustivamente); formato de error propio (RFC 9457 es estándar y bien soportado).

## R15. Pruebas

- **Decisión**:
  - **Dominio** (`packages/domain`): Vitest, unitarias con repositorios en memoria. Cubre
    todos los casos de uso y reglas.
  - **API** (`apps/api`): Vitest + `app.inject()` contra PostgreSQL real (servicio
    `db-test` en Docker Compose, en `tmpfs`), con migraciones aplicadas y BD limpia por
    archivo de prueba. Incluye pruebas de contrato que validan las respuestas contra
    `contracts/openapi.yaml`, y prueba de `up`/`down` de cada migración.
  - **Web** (`apps/web`): Vitest + Testing Library + `vitest-axe` para componentes críticos.
  - **E2E** (`e2e/`): Playwright con los recorridos P1–P4 en viewport de escritorio y de
    320 px, más auditoría `@axe-core/playwright` (SC-004 a SC-006).
  - Un único comando `npm test` ejecuta dominio, API y web; `npm run test:e2e` los E2E.
- **Alternativas**: Jest (más lento y configuración ESM más compleja); Testcontainers
  (requiere acceso al socket de Docker desde los contenedores; Compose es más simple).

## R16. Docker Compose y configuración **[SEG]**

- **Decisión**: servicios `db` (PostgreSQL 17), `db-test` (PostgreSQL 17 en `tmpfs`),
  `migrate` (ejecuta migraciones y `board:init`, termina), `api` (depende de `migrate`),
  `web` (servidor de desarrollo Vite con *proxy* `/api` → `api`, mismo origen → sin CORS).
  - Configuración por variables de entorno validadas con Zod al arrancar
    (`apps/api/src/config/env.ts`); la API no arranca si falta alguna.
  - `.env` en `.gitignore`; `.env.example` con valores ficticios (Principio V). Las
    credenciales de la BD local solo existen en `.env`.
  - Imágenes fijadas por versión (`postgres:17-alpine`, `node:24-alpine`).
- **Alternativas**: ejecución sin contenedores (no reproducible); migraciones al arrancar la
  API (condiciones de carrera con varias réplicas en el futuro).

## R17. Observabilidad (mínima en v1)

- **Decisión**: logs estructurados JSON con pino (incluido en Fastify), `requestId` por
  petición, redacción de `Authorization`, endpoint `GET /api/health` (comprueba BD). Sin
  métricas ni trazas distribuidas en v1.
- **Alternativas**: OpenTelemetry (prematuro para una sola instancia).
