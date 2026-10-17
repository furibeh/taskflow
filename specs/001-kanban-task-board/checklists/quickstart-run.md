# Quickstart Run: TaskFlow v1

**Fecha**: 2026-10-17 | **Guía**: [quickstart.md](../quickstart.md) | **Tarea**: T134

Registro de la validación del quickstart. Las secciones automatizables las ejecutó el asistente;
la revisión con lector de pantalla queda pendiente de una persona.

## 1–2. Configuración y arranque (`docker compose up --build`)

| Comprobación | Resultado |
|---|---|
| `.env` ignorado por git (`git check-ignore .env`) | ✅ |
| `migrate` aplica 0001–0004 y termina con código 0 | ✅ |
| Primer arranque: el enlace se imprime una sola vez | ✅ (arranques posteriores: "El tablero ya existe") |
| `GET /api/health` (API y a través del proxy de la web) | ✅ `{"status":"ok"}` |
| Web en `http://localhost:5173` | ✅ 200 |

## 3. Pruebas automatizadas

| Suite | Resultado |
|---|---|
| `npm run lint`, `npm run lint:deps`, `npm run typecheck` | ✅ sin errores |
| `npm test` (dominio 61, API 65, web 51) | ✅ 177/177 |
| `npm run test:e2e` | ✅ 44 pasan, 4 omitidas a propósito (arrastre y rendimiento en 320 px; regeneración en un solo proyecto) |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades |

Tiempos medidos con 200 tareas (SC-003, objetivo < 1 s): carga 386 ms, búsqueda 906 ms (incluye
300 ms de espera deliberada), filtro 486 ms, cambio de estado 172 ms.

## 4. Escenarios manuales

Los 19 escenarios están cubiertos por pruebas E2E en escritorio y 320 px:

| # | Escenario | Cubierto por |
|---|---|---|
| 1–4 | Tablero vacío, crear, título inválido, persistencia | `us1-board-create.spec.ts` |
| 5 | Personas | `us6-people.spec.ts` |
| 6–7 | Asignar y mover sin responsable | `us3-assign.spec.ts` |
| 8, 8b | Estado con teclado, arrastrar y soltar | `us2-status.spec.ts`, `a11y-responsive.spec.ts` |
| 9–11 | Búsqueda, sin coincidencias, filtros persistentes | `us4-search-filter.spec.ts` |
| 12–13 | Borrar y deshacer, borrado definitivo | `us5-edit-delete.spec.ts` |
| 14 | Quitar persona con tareas | `us6-people.spec.ts`, pruebas de componente |
| 15 | Fallo de guardado y reintento | `save-failure.spec.ts`, `us2-status.spec.ts` |
| 16–17 | Enlace regenerado, enlace incorrecto | `access.spec.ts` |
| 18 | Texto peligroso | `board.test.tsx`, `tasks-create.test.ts` |
| 19 | Móvil 320 px | proyecto `mobile-320` de todos los E2E |

## 5. Comprobaciones rápidas de la API

| Comprobación | Resultado |
|---|---|
| Código incorrecto → 401 | ✅ `INVALID_LINK` |
| `counts` con código válido y `VALIDATION_ERROR` | ✅ cubiertos por pruebas de integración; no se ejecutaron contra el entorno de desarrollo para no regenerar el enlace en uso |

## 6. Migraciones

| Comprobación | Resultado |
|---|---|
| `db:migrate:down` y `db:migrate` | ✅ contra la base de datos de **pruebas** (`db-test`). No se ejecutó contra la de desarrollo porque revertir 0004 borra la tabla de tareas y sus datos. Cubierto también por `migrations.test.ts` (ida y vuelta de las 4 migraciones). |

## Pendiente (requiere una persona)

- [ ] Revisión manual con lector de pantalla (NVDA o VoiceOver) de: crear, cambiar estado,
  arrastrar y soltar con teclado, asignar, filtrar, y borrar/deshacer, frente a WCAG 2.1 AA
  (SC-006). La auditoría automática (axe) no detecta incumplimientos, pero no sustituye esta
  revisión.
