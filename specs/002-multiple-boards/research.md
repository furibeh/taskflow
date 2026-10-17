# Research: Múltiples tableros (uno por equipo)

**Fecha**: 2026-10-17 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Continúa la numeración de `specs/001-kanban-task-board/research.md` (R1–R17), cuyas
decisiones siguen vigentes salvo donde se indica. Formato Decisión / Justificación /
Alternativas. Las marcadas **[ARQ]** o **[SEG]** requieren aprobación explícita antes de
implementarse (constitución, "Decisiones de arquitectura o seguridad").

Punto de partida verificado en el código:

- `board_id` ya existe en `person` y `task` con `ON DELETE CASCADE` (D7), y todos los
  repositorios filtran por `board_id` (`task-repository.ts`, `person-repository.ts`).
- El plugin `auth` (`apps/api/src/http/plugins/auth.ts`) resuelve el tablero a partir del
  código Bearer con `resolveBoard`; los casos de uso solo reciben el tablero resuelto.
- La asignación ya comprueba que la persona pertenece al tablero (`existsInBoard`), aunque la
  FK `task.assignee_id → person.id` no incluya `board_id`.
- Suposiciones de tablero único: `BoardRepository.findAny`, `initBoard` (crea solo si no hay
  ninguno) y `board-rotate.ts` (regenera "el" tablero); el hook de auth cubre todo `/api/v1`.

---

## R18. Creación pública de tableros desde la web **[SEG]**

- **Decisión**: nueva ruta `POST /api/v1/boards` **sin autenticación**, registrada en un
  ámbito Fastify hermano del autenticado (el hook `onRequest` de `auth` no la cubre). Defensas:
  1. **Límite propio por IP** (el "origen de red" de FR-105 es la IP real del cliente): `FixedWindowLimiter` existente (`http/rate-limiter.ts`) con
     ventana de 1 hora y máximo `BOARD_CREATION_PER_HOUR` (por defecto 10, mínimo 1;
     FR-105). Solo cuentan las creaciones nuevas (no las repeticiones idempotentes ni las
     peticiones rechazadas por validación). Al superarlo: `429 BOARD_CREATION_LIMITED` con
     `Retry-After`. La IP es la real tras el proxy según `TRUST_PROXY` (D11).
  2. **Interruptor**: `BOARD_CREATION_ENABLED` (por defecto `true`). Con `false`, la ruta
     responde `403 BOARD_CREATION_DISABLED` sin tocar la BD (FR-106).
  3. Se mantienen el límite global y el de escrituras por IP (D5) y el cuerpo ≤ 16 KiB.
- **Justificación**: FR-102 exige crear sin cuentas. El límite por IP y el interruptor
  contienen el abuso sin introducir identidad; el limitador en memoria ya se usa para los 401
  y vale con una sola instancia de API (mismo supuesto que D6).
- **Alternativas**: CAPTCHA o prueba de trabajo (dependencia externa o fricción, y penaliza
  accesibilidad); clave de instancia para crear (contradice "cualquiera"); límite global de
  tableros (descartado en la spec: un atacante bloquearía a todos); límite con
  `@fastify/rate-limit` por ruta (no permite contar solo las creaciones nuevas).
- **Sustituye a**: D4 de la 001 ("primer enlace solo por consola"). `board:init` se conserva
  para la consola (R23).

## R19. Creación idempotente con código generado por el servidor **[SEG]**

- **Problema**: la creación debe ser idempotente (FR-104: un reintento tras timeout no crea
  dos tableros) y el enlace solo se muestra una vez (FR-103). Como el servidor solo guarda el
  hash del código (D3), una repetición tras un timeout no puede devolver el código de un
  tablero que sí se creó.
- **Decisión** (opción elegida por el usuario): se mantiene D3, el código lo genera **siempre
  el servidor** (`nodeAccessCodeService`). El cliente genera solo el `id` (UUID, como D9) y
  envía `{ id, name }` en `POST /api/v1/boards`.
  - Tablero nuevo → `201 { id, name, accessCode }` con `Cache-Control: no-store`; es la única
    vez que el código sale del servidor.
  - Repetición con el mismo `id` y el mismo nombre normalizado → `200 { id, name }` **sin
    código**. La web lo interpreta como "creado sin enlace" y muestra
    "El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero." (FR-104); el formulario genera un `id` nuevo para el siguiente intento.
  - Mismo `id` con otro nombre → `409 ID_CONFLICT`.
- **Consecuencia aceptada**: si la respuesta del `201` se pierde, el tablero queda huérfano
  (existe, pero nadie tiene su enlace). Es un caso raro (timeout o corte justo después de
  crear), el tablero está vacío y quien administra puede borrarlo con `board:list` /
  `board:delete` (FR-119). No se intenta recuperarlo.
- **Protección del código**: la respuesta no se registra (pino no registra cuerpos; una prueba
  verifica que el código no aparece en los logs) y lleva `no-store`.
- **Alternativas**: (A) el cliente genera el código y el servidor solo guarda el hash
  (idempotencia completa, pero rompe D3: la fortaleza del código pasa a depender del cliente,
  el código viaja en el cuerpo y un `409` sirve de oráculo); (C) testigo de creación del
  cliente que permite regenerar el código en un reintento durante unos minutos (sin huérfanos,
  pero añade un secreto temporal, una ventana y más pruebas). Se elige la más simple porque el
  daño del caso raro se limita a un tablero vacío borrable.

## R20. Borrado definitivo del tablero **[SEG] [ARQ]**

- **Decisión**: `DELETE /api/v1/board` borra físicamente la fila `board` en una sola
  sentencia; las FK `ON DELETE CASCADE` existentes borran personas y tareas (incluidas las
  borradas lógicamente pendientes de purga). Respuesta `204`. Sin ventana de deshacer
  (clarificación de la spec). La confirmación (escribir el nombre exacto) es de la interfaz;
  el servidor no la repite.
- **Peticiones en vuelo**: una escritura autenticada justo antes del borrado puede intentar
  insertar con un `board_id` que ya no existe. El manejador de errores traduce la violación
  de FK sobre `board_id` (`23503`, restricciones `person_board_id_fkey` y
  `task_board_id_fkey`) a `401 INVALID_LINK`, la misma respuesta que recibirá cualquier
  petición posterior (FR-116).
- **Riesgo aceptado**: quien tenga un enlace filtrado puede borrar todos los datos del equipo
  sin vuelta atrás; la única recuperación es la copia de seguridad (fuera de alcance, ver la
  001). Mitigación: confirmación con el nombre escrito y límites de escrituras por IP.
- **Alternativas**: borrado lógico + purga diferida (descartado por el usuario en la
  clarificación); exigir el nombre también en el servidor (`confirmName`) (añade un código de
  error y un caso de concurrencia con el renombrado sin proteger frente a un atacante, que ya
  conoce el nombre).

## R21. Migración `0005_board_name` **[ARQ]**

- **Decisión**: una migración que añade a `board`:
  - `name text NOT NULL` con `CHECK (char_length(name) BETWEEN 1 AND 60)`; las filas
    existentes reciben `'Mi tablero'` (FR-118) y después se elimina el `DEFAULT`, para que el
    valor siempre lo aporte el dominio.
  - `updated_at timestamptz NOT NULL`, rellenado con `created_at`; lo actualizan el
    renombrado y la regeneración del enlace con la fecha del `Clock` del dominio.
  - `down`: elimina ambas columnas (reversible; se pierde el nombre).
- **Justificación**: constitución VI; no hace falta migrar datos de `person` ni `task` gracias
  a D7.
- **Alternativas**: dos migraciones (sin ventaja); nombre nulo con valor por defecto en la
  interfaz (deja la regla fuera del dominio).

## R22. Configuración pública para la pantalla de inicio **[ARQ]**

- **Decisión**: `GET /api/v1/public-config` sin autenticación devuelve
  `{ boardCreationEnabled: boolean }`. La web la consulta en la pantalla de inicio y en
  "Enlace no válido" para decidir si ofrece "Crear tablero" (FR-106, FR-107). No revela nada
  de ningún tablero.
- **Alternativas**: variable de compilación de Vite (obliga a reconstruir la web para cambiar
  la configuración de la API y puede desincronizarse); mostrar siempre el botón y fallar con
  `403` (contradice FR-106).

## R23. Comandos de consola para varios tableros

- **Decisión**: scripts de `apps/api` con argumentos leídos por `node:util.parseArgs`:
  - `board:create --name "<nombre>"`: crea un tablero e imprime su enlace una vez.
  - `board:init`: se conserva para Compose y para instalaciones con la creación web
    desactivada; crea "Mi tablero" solo si no hay ningún tablero (ahora con `count()` en lugar
    de `findAny`).
  - `board:list`: tabla con id, nombre, creación, nº de tareas (no borradas) y de personas y
    última actividad (R24); nunca muestra códigos ni hashes.
  - `board:rotate [--board <id>]`: obligatorio si hay más de un tablero; con uno solo se
    mantiene el comportamiento actual (los E2E y el quickstart de la 001 siguen funcionando).
  - `board:delete --board <id> [--confirm "<nombre>"]`: muestra nombre y recuentos y pide
    escribir el nombre (o lo toma de `--confirm` en uso no interactivo); si no coincide, no
    borra.
  - Identificador inexistente o mal formado → mensaje claro y código de salida 1 (FR-119a).
- **Justificación**: FR-119; los nombres no son únicos, por eso las operaciones reciben el id
  que muestra `board:list`.
- **Alternativas**: comandos con el nombre como clave (ambiguo); una consola web de
  administración (nueva superficie de ataque; descartada al acotar el alcance).

## R24. "Última actividad" en el listado de consola

- **Decisión**: valor derivado en la consulta de `board:list`:
  `greatest(board.updated_at, max(task.updated_at), max(task.deleted_at), max(person.created_at))`.
  Quitar una persona no deja rastro (borrado físico) y no cuenta; se documenta como
  aproximación suficiente para detectar tableros abandonados.
- **Alternativas**: columna `last_activity_at` actualizada en cada escritura (toca todos los
  repositorios y añade una escritura por operación para un dato que solo se lee en consola).

## R25. Contrato de la API de la feature 002

- **Decisión**: `specs/002-multiple-boards/contracts/openapi.yaml` es el contrato completo y
  vigente (copia de la 001 más los cambios); el cargador de las pruebas de contrato
  (`apps/api/tests/contract/openapi.ts`) pasa a apuntar a esa ruta y `CLAUDE.md` se actualiza.
  El de la 001 queda como histórico. La versión sube a `1.1.0` (cambios compatibles: rutas
  nuevas, campos nuevos en `Board`, códigos de error nuevos).
- **Alternativas**: editar el contrato de la 001 (mezcla features y pierde la trazabilidad);
  un contrato parcial solo con lo nuevo (las pruebas tendrían que cargar dos archivos).

## R26. Interfaz: inicio, creación y gestión del tablero

- **Decisión** (`apps/web`):
  - `features/home/`: `HomePage` (sin código en el fragmento) con "Crear tablero" y la
    explicación del enlace; `InvalidLinkPage` añade la misma acción (FR-107). Ambas consultan
    `public-config`.
  - `CreateBoardForm`: genera el `id` una vez por intento y lo reutiliza en "Reintentar"
    (idempotencia); con `201` muestra `NewBoardLinkDialog` con "Copiar enlace" y "Abrir
    tablero"; con `200` (repetición de un tablero ya creado) muestra el aviso de tablero creado
    sin enlace y prepara un `id` nuevo. El diálogo recuerda si se copió el enlace o se abrió el tablero
    y, si no, al cerrar pide la confirmación de FR-103a.
  - "Abrir tablero" usa el `setAccessCode` existente (`app/access-code.ts`) y vacía la caché de
    consultas, igual que el cambio de fragmento actual.
  - Cabecera: el `h1` muestra el nombre del tablero (`GET /board`) y `document.title` pasa a
    ser `«nombre» · TaskFlow` (FR-113). Menú "Tablero" con "Cambiar nombre" y "Borrar tablero".
  - `DeleteBoardDialog`: muestra nombre y recuentos (`taskCount`, `personCount` de
    `GET /board`), habilita el botón solo si el texto escrito coincide exactamente con el nombre
    (tras recortar espacios) y, al confirmarse, borra el código en memoria y del fragmento y
    vuelve a la pantalla de inicio con el aviso "Tablero «nombre» borrado".
  - El cliente HTTP ya omite `Authorization` sin código; las rutas públicas no reciben el
    código aunque exista (opción `auth: false` en la petición) para no enviarlo donde no hace
    falta.
- **Alternativas**: página separada (`/new`) con enrutador (añade dependencia para dos
  pantallas); recordar tableros en `localStorage` (descartado: un enlace, un tablero).

## R27. Aislamiento entre tableros

- **Decisión**: no se cambia el modelo de autorización; se demuestra con pruebas de
  integración nuevas (dos tableros reales): leer, editar, mover, borrar y restaurar tareas de
  otro tablero da `404 TASK_NOT_FOUND`; quitar una persona ajena, `404 PERSON_NOT_FOUND`;
  asignar una persona ajena, `422 ASSIGNEE_NOT_FOUND`; regenerar o borrar A no afecta a B; la
  búsqueda y los filtros solo devuelven datos propios; dos tableros admiten la misma persona.
- **Justificación**: FR-108–FR-111 y SC-102; constitución III (pertenencia del recurso) y la
  regla "un usuario solo accede a los recursos de sus equipos".
- **Alternativas**: FK compuesta `(board_id, assignee_id)` para que la BD impida asignaciones
  cruzadas (más robusto pero requiere índice único `(board_id, id)` en `person` y cambiar la
  FK de `task`; se deja anotado como mejora, ya que el dominio lo garantiza y se prueba).
