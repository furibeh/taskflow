# Data Model: Tablero Kanban de Tareas (TaskFlow v1)

**Fecha**: 2026-10-17 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Modelo de dominio (independiente de la persistencia) y su correspondencia en PostgreSQL. Los
identificadores son UUID v4. Las fechas son `timestamptz` en UTC. Los textos se normalizan
(`trim` + Unicode NFC) antes de validarse y las longitudes se miden en *code points*.

## Diagrama

```text
┌──────────────┐ 1      N ┌──────────────┐ 0..1    N ┌──────────────┐
│    Board     │──────────│    Person    │───────────│     Task     │
│              │ 1                     N │ assignee  │              │
│              │─────────────────────────────────────│              │
└──────────────┘                                     └──────────────┘
```

Un tablero contiene personas y tareas. Una tarea tiene cero o un responsable (Persona) del
mismo tablero. En v1 existe un solo tablero, pero `board_id` se incluye en todas las tablas
para no requerir una migración de datos cuando haya varios (decisión D7 en
[plan.md](./plan.md)).

---

## Board (Tablero)

| Campo | Tipo dominio | Columna PostgreSQL | Reglas |
|---|---|---|---|
| id | `BoardId` (UUID) | `id uuid PK` | |
| accessCodeHash | bytes | `access_code_hash bytea NOT NULL UNIQUE` | SHA-256 del código; el código en claro nunca se persiste |
| accessCodeRotatedAt | `Date` | `access_code_rotated_at timestamptz NOT NULL` | Se actualiza al regenerar |
| createdAt | `Date` | `created_at timestamptz NOT NULL DEFAULT now()` | |

**Operaciones**: `resolveByAccessCode(code)`, `regenerateAccessCode()` → devuelve el código
nuevo una sola vez (FR-028a–d).

## Person (Persona)

| Campo | Tipo dominio | Columna PostgreSQL | Reglas |
|---|---|---|---|
| id | `PersonId` (UUID) | `id uuid PK` | Generado por el cliente (idempotencia) |
| boardId | `BoardId` | `board_id uuid NOT NULL FK → board(id) ON DELETE CASCADE` | |
| name | `PersonName` | `name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50)` | 1–50 caracteres tras normalizar (FR-016a) |
| createdAt | `Date` | `created_at timestamptz NOT NULL DEFAULT now()` | |

**Índices / restricciones**:
- `UNIQUE (board_id, lower(name))` — unicidad sin distinguir mayúsculas (FR-016a). El dominio
  comprueba antes para devolver `PERSON_NAME_TAKEN`; el índice es la garantía final ante
  condiciones de carrera.

**Valores derivados** (no almacenados): `assignedTaskCount` = tareas no borradas con
`assignee_id = id` (usado en la confirmación de FR-016b).

**Eliminación**: borrado físico. Las tareas asignadas pasan a sin asignar mediante
`ON DELETE SET NULL` (FR-016b, FR-013d). No se puede deshacer (supuesto de la spec).

## Task (Tarea)

| Campo | Tipo dominio | Columna PostgreSQL | Reglas |
|---|---|---|---|
| id | `TaskId` (UUID) | `id uuid PK` | Generado por el cliente (FR-011) |
| boardId | `BoardId` | `board_id uuid NOT NULL FK → board(id) ON DELETE CASCADE` | |
| title | `TaskTitle` | `title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)` | Obligatorio (FR-009) |
| description | `TaskDescription` | `description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000)` | Opcional; vacía = `''` |
| status | `TaskStatus` | `status task_status NOT NULL DEFAULT 'pending'` | Enum (FR-020) |
| assigneeId | `PersonId \| null` | `assignee_id uuid NULL FK → person(id) ON DELETE SET NULL` | Opcional en cualquier estado (FR-015) |
| createdAt | `Date` | `created_at timestamptz NOT NULL DEFAULT now()` | Orden de las columnas (FR-004) |
| updatedAt | `Date` | `updated_at timestamptz NOT NULL DEFAULT now()` | Se actualiza en cada modificación |
| deletedAt | `Date \| null` | `deleted_at timestamptz NULL` | Borrado lógico durante la ventana de deshacer |

**Índices**:
- `(board_id, created_at DESC) WHERE deleted_at IS NULL` — carga del tablero.
- `(assignee_id) WHERE deleted_at IS NULL` — filtro por responsable y recuento.
- `(deleted_at) WHERE deleted_at IS NOT NULL` — purga periódica.

**Restricción de integridad entre tablas**: el responsable debe pertenecer al mismo tablero.
Se valida en el caso de uso (`ASSIGNEE_NOT_FOUND` si no existe en el tablero).

## TaskStatus (Estado)

Enum cerrado `task_status`: `pending` | `in_progress` | `done`.

| Valor API | Etiqueta UI | Orden de columna |
|---|---|---|
| `pending` | Pendiente | 1 |
| `in_progress` | En progreso | 2 |
| `done` | Hecha | 3 |

### Transiciones

```text
          ┌───────────────────────────────┐
          ▼                               │
     ┌─────────┐   ┌──────────────┐   ┌──────┐
 ──▶ │ pending │◀─▶│ in_progress  │◀─▶│ done │
     └─────────┘   └──────────────┘   └──────┘
          ▲                               │
          └───────────────────────────────┘
```

- Toda tarea nace en `pending` (FR-008).
- Se permite cualquier transición entre estados distintos (FR-018), con o sin responsable
  (FR-015). Cambiar al mismo estado es una operación sin efecto (idempotente).

### Ciclo de vida del borrado

```text
 activa ──DELETE──▶ borrada (deleted_at = t) ──restore (≤ t+15 s)──▶ activa
                              │
                              └── purga (> t+15 s) ──▶ eliminada físicamente
```

## Reglas de validación (resumen)

| Regla | Origen | Error |
|---|---|---|
| Título 1–200 caracteres tras normalizar | FR-009 | `VALIDATION_ERROR` (campo `title`, código `too_short`/`too_long`) |
| Descripción ≤ 5.000 caracteres | FR-009 | `VALIDATION_ERROR` (campo `description`) |
| Estado ∈ {pending, in_progress, done} | FR-020 | `VALIDATION_ERROR` (campo `status`) |
| Responsable existe en el tablero | FR-017 | `ASSIGNEE_NOT_FOUND` |
| Nombre de persona 1–50 caracteres | FR-016a | `VALIDATION_ERROR` (campo `name`) |
| Nombre de persona único (sin mayúsculas) | FR-016a | `PERSON_NAME_TAKEN` |
| Búsqueda ≤ 100 caracteres, literal | FR-024b | `VALIDATION_ERROR` (campo `q`) |
| Restauración dentro de la ventana | FR-013c | `UNDO_EXPIRED` |
| Tarea existe y no está borrada | FR-013b | `TASK_NOT_FOUND` |
| `id` repetido con datos distintos | FR-011 | `ID_CONFLICT` |

## Migraciones

Migraciones Kysely versionadas en `apps/api/src/persistence/migrations/`, cada una con `up` y
`down` probados (Principio VI):

1. `0001_extensions` — `CREATE EXTENSION IF NOT EXISTS unaccent`.
2. `0002_board` — tabla `board`.
3. `0003_person` — tabla `person` e índice único `(board_id, lower(name))`.
4. `0004_task` — tipo `task_status`, tabla `task` e índices.
