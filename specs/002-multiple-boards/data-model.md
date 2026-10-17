# Data Model: Múltiples tableros (uno por equipo)

**Fecha**: 2026-10-17 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Cambios sobre `specs/001-kanban-task-board/data-model.md`, que sigue vigente para **Person** y
**Task** (sin cambios de esquema). Mismas convenciones: UUID v4, `timestamptz` UTC, textos
normalizados (`trim` + NFC) y longitudes en *code points*.

## Diagrama

```text
┌──────────────┐ 1      N ┌──────────────┐ 0..1    N ┌──────────────┐
│    Board     │──────────│    Person    │───────────│     Task     │
│ (0..N por    │ 1                     N │ assignee  │              │
│  instalación)│─────────────────────────────────────│              │
└──────────────┘          ON DELETE CASCADE          └──────────────┘
```

Una instalación tiene cero o más tableros. Cada persona y cada tarea pertenecen a
exactamente un tablero; el responsable de una tarea debe ser una persona del mismo tablero
(lo garantiza el dominio con `existsInBoard`, research R27).

---

## Board (Tablero) — modificada

| Campo | Tipo dominio | Columna PostgreSQL | Reglas |
|---|---|---|---|
| id | `BoardId` (UUID) | `id uuid PK` | Generado por el cliente en la web (idempotencia, R19) o por el servidor en la consola |
| name | `BoardName` | `name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60)` | **Nuevo.** 1–60 caracteres tras normalizar; no único (FR-112) |
| accessCodeHash | bytes | `access_code_hash bytea NOT NULL UNIQUE` | SHA-256 del código; el código en claro nunca se persiste |
| accessCodeRotatedAt | `Date` | `access_code_rotated_at timestamptz NOT NULL` | Se actualiza al regenerar |
| createdAt | `Date` | `created_at timestamptz NOT NULL DEFAULT now()` | El valor lo fija siempre el `Clock` del dominio |
| updatedAt | `Date` | `updated_at timestamptz NOT NULL` | **Nuevo.** Al crear = `createdAt`; se actualiza al renombrar y al regenerar el enlace |

**Constantes** (`packages/domain/src/shared/limits.ts`): `BOARD_NAME_MIN = 1`,
`BOARD_NAME_MAX = 60`, `DEFAULT_BOARD_NAME = 'Mi tablero'`.

**Valores derivados** (no almacenados):

- `taskCount`: tareas no borradas del tablero; `personCount`: personas del tablero (para la
  confirmación de borrado, FR-115).
- `lastActivityAt` (solo consola, R24): `greatest(updated_at, max(task.updated_at),
  max(task.deleted_at), max(person.created_at))`.

### Ciclo de vida

```text
          crear (web o consola)                 borrar (web o consola)
   ∅ ───────────────────────────▶ Activo ───────────────────────────────▶ ∅
                                   │  ▲         (físico, en cascada; sin deshacer)
             renombrar / regenerar │  │
                                   └──┘
```

No hay estado intermedio: tras el borrado, el hash del código ya no existe y cualquier
petición con él recibe `401 INVALID_LINK` (FR-116).

### Puerto `BoardRepository` (dominio) — modificado

| Operación | Cambio | Uso |
|---|---|---|
| `findByAccessCodeHash(hash)` | sin cambios | autenticación |
| `findById(id)` | nueva | consola (`rotate`, `delete`) |
| `count()` | nueva; sustituye a `findAny()` | `board:init`, `board:rotate` sin `--board` |
| `insert(board)` → `'inserted' \| 'id_taken'` | indica si el `id` ya existía | creación idempotente (R19) |
| `rename(id, name, updatedAt)` | nueva | FR-114 |
| `updateAccessCodeHash(id, hash, rotatedAt)` | actualiza también `updated_at` | FR-028b |
| `delete(id)` → `boolean` | nueva | FR-116 |
| `getStats(id)` → `{ taskCount, personCount }` | nueva | confirmación de borrado |
| `listSummaries()` → `BoardSummary[]` | nueva | `board:list` (R23, R24) |

### Casos de uso (dominio)

| Caso de uso | Entrada | Resultado | Errores |
|---|---|---|---|
| `createBoard` | `{ id, name }`; el código lo genera `accessCodes.generate()` | `{ created: true, board, accessCode }` o `{ created: false, board }` (repetición: sin código) | `VALIDATION_ERROR` (nombre), `ID_CONFLICT` |
| `initBoard` | — | como hoy; usa `createBoard` con `DEFAULT_BOARD_NAME` si `count() = 0` | — |
| `renameBoard` | `boardId`, `name` | `Board` | `VALIDATION_ERROR`, `BOARD_NOT_FOUND` (el tablero se borró entre la autenticación y la escritura) |
| `deleteBoard` | `boardId` | `void` | `BOARD_NOT_FOUND` (consola: id inexistente; HTTP: borrado concurrente) |
| `getBoardDetails` | `boardId` | `Board` + `taskCount` + `personCount` | — |
| `listBoards` | — | `BoardSummary[]` | — |
| `resolveBoard`, `regenerateAccessCode` | sin cambios | | |

Reglas de `createBoard`:

1. Normaliza y valida el nombre (`BoardName`, mismas reglas de texto que `PersonName`).
2. Genera el código, calcula su hash e intenta insertar.
3. `id_taken`: si el tablero existente tiene el mismo nombre normalizado →
   `{ created: false, board }` (el código nuevo se descarta; nunca se devuelve el original,
   que no se conoce); si no → `ID_CONFLICT`.
4. Una colisión del hash con otro tablero (probabilidad 2⁻²⁵⁶) no se trata: la restricción
   `UNIQUE` la convierte en error interno.

Errores de dominio nuevos (`shared/errors.ts`): `BOARD_NOT_FOUND`. Los códigos HTTP
`BOARD_CREATION_DISABLED` y `BOARD_CREATION_LIMITED` son de la capa HTTP (como
`RATE_LIMITED`), no del dominio.

En HTTP, `BOARD_NOT_FOUND` se traduce a `401 INVALID_LINK` (el tablero del código ya no
existe, FR-116); en la consola, al mensaje "No existe ningún tablero con ese id" (FR-119a).

## Person, Task — sin cambios

Siguen la 001. El borrado del tablero las elimina por `ON DELETE CASCADE`; la unicidad del
nombre de persona ya es por tablero (`person_board_name_unique`, FR-110).

## Migraciones

| Versión | Contenido | `down` |
|---|---|---|
| `0005_board_name` | `ALTER TABLE board ADD COLUMN name text NOT NULL DEFAULT 'Mi tablero'`, `ADD CONSTRAINT board_name_length CHECK (char_length(name) BETWEEN 1 AND 60)`, `ALTER COLUMN name DROP DEFAULT`; `ADD COLUMN updated_at timestamptz`, `UPDATE board SET updated_at = created_at`, `ALTER COLUMN updated_at SET NOT NULL` | `DROP COLUMN updated_at`, `DROP COLUMN name` (reversible; se pierde el nombre) |

Se registra a mano en `apps/api/src/persistence/migrations/index.ts`. Prueba
(`tests/migrations/migrations.test.ts`): con un tablero, una persona y una tarea creados en
`0004`, `up` conserva todo y deja `name = 'Mi tablero'` y `updated_at = created_at`; `down`
vuelve al esquema de `0004` sin perder personas ni tareas.
