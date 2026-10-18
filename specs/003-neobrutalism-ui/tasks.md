---

description: "Lista de tareas para implementar el estilo neobrutalista (feature 003)"
---

# Tasks: Estilo visual neobrutalista

**Input**: Design documents from `/specs/003-neobrutalism-ui/`

**Prerequisites**: plan.md, spec.md, research.md (R28–R34), contracts/ui-tokens.md,
quickstart.md

**Tests**: INCLUIDAS. La constitución (Principio IV) y SC-001–SC-006 exigen pruebas de
contraste, accesibilidad, 44 px, 320 px, movimiento reducido y CSP. Las pruebas de cada
historia se escriben primero y DEBEN fallar antes de implementar (salvo las que protegen
comportamiento existente, que deben pasar antes y después).

**Gate**: decisiones D17 (tipografía autoalojada) y D18 (conjunto único de tokens) de
`plan.md` aprobadas por el usuario el 2026-10-17. Cualquier decisión nueva de arquitectura o
seguridad que surja durante la implementación debe explicarse y aprobarse antes de aplicarse.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Solo cambia `apps/web/` y `e2e/`. Los valores de los tokens y la tabla de contrastes son los de
`specs/003-neobrutalism-ui/contracts/ui-tokens.md` (en adelante, "el contrato de estilo"). Regla
común a todas las hojas: fuera de `apps/web/src/ui/tokens.css` no hay colores literales (`#…`,
`rgb(`, `hsl(`); solo `var(--…)`, `currentColor`, `transparent` y colores del sistema dentro de
`@media (forced-colors: active)`. No cambia ningún texto, nombre accesible ni orden del DOM
(FR-012).

**Orden de historias**: US1 (P1) → US2 (P2) → US3 (P3). Todas dependen de la Phase 2.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia de la tipografía (D17).

- [X] T001 Add `@fontsource-variable/space-grotesk` (`^5.3.0`, OFL-1.1) to `dependencies` of `apps/web/package.json` with `npm install -w apps/web @fontsource-variable/space-grotesk`, commit the updated `package-lock.json`, and confirm `npm audit --omit=dev` reports no new vulnerabilities

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Conjunto de tokens neobrutalista (D18) con sus contrastes verificados, y
tipografía cargada. **Ninguna historia empieza antes de terminar esta fase.** Tras esta fase la
interfaz ya cambia de colores, pero los componentes conservan bordes y radios antiguos hasta
US1–US3.

- [X] T002 [P] Write failing test `apps/web/tests/ui/tokens.test.ts` (Vitest, `node:fs` + `node:path`, no DOM): parse `apps/web/src/ui/tokens.css`, extract the custom properties of the first `:root` block (light) and of the `:root` inside `@media (prefers-color-scheme: dark)` (dark, inheriting light values not redefined); for each theme assert every pair of the "Tabla de contrastes" of the contract (text ≥ 4.5 — `text`, `text-muted`, `primary`, `danger` against `bg`/`surface`/`danger-bg`/`status-*-soft` as listed, `on-primary`/`primary`, `on-danger`/`danger`, `on-status`/`status-*`; UI ≥ 3 — `border`, `focus` against `bg`/`surface`/`status-*-soft`) using the WCAG 2.1 relative-luminance formula implemented in the test; assert all tokens of the contract's "Tokens de color" table are defined in the light block and resolve in the dark theme (the dark theme inherits from light any token it does not redefine); and assert that no `*.css` under `apps/web/src` other than `ui/tokens.css` contains `#[0-9a-f]{3,8}`, `rgb(`, `rgba(`, `hsl(` (case-insensitive, ignoring comments). Fails now (missing tokens and 3 literals in `ui/ui.css` and `features/board/board.css`)
- [X] T003 Rewrite `apps/web/src/ui/tokens.css` with the light and dark values of the contract: color tokens (`--color-bg` … `--color-status-done-soft`, including `--color-shadow`, `--color-on-danger`, `--color-backdrop`, `--color-on-status`), removing `--color-column` and `--color-primary-hover` (replace their uses: `.column` background → `var(--color-surface)` until US2, `.btn--primary:hover` rule deleted); shape tokens `--font` (Space Grotesk Variable + current system stack), `--font-mono`, `--border-width: 3px`, `--border-width-sm: 2px`, `--border: var(--border-width) solid var(--color-border)`, `--border-sm`, `--radius: 4px`, `--shadow-offset: 4px`, `--shadow-offset-sm: 2px`, `--shadow`, `--shadow-sm`, `--shadow-lg: 8px 8px 0 var(--color-shadow)`, `--press-duration: 80ms` and `@media (prefers-reduced-motion: reduce) { :root { --press-duration: 0s } }`; keep `--space-*`, `--tap-size`, `color-scheme: light dark`, base `body` rules (`font-weight: 500`), `.visually-hidden` and the WCAG comment updated to point to the contract. Replace the three literals: `.dialog::backdrop` → `var(--color-backdrop)` in `apps/web/src/ui/ui.css`, `.toast` and `.card--overlay` shadows → `var(--shadow)` / `var(--shadow-lg)` in `ui/ui.css` and `features/board/board.css`. T002 passes
- [X] T004 Import `@fontsource-variable/space-grotesk` as the first CSS import of `apps/web/src/main.tsx` (before `./ui/tokens.css`); run `npm run build -w apps/web` and check that the `woff2` files are emitted under `dist/assets` and that the latin + latin-ext `woff2` together are ≤ 100 KB (SC-006) and the emitted CSS contains `font-display: swap` for the font (FR-010); run `npm test -w apps/web` and, with `db-test` up, `npx playwright test tests/a11y-responsive.spec.ts tests/security-headers.spec.ts` from `e2e/` (the existing light and dark axe checks, contrast included, must pass with the new palette)

**Checkpoint**: tokens y tipografía listos; `npm test` en verde.

---

## Phase 3: User Story 1 - Sistema visual base neobrutalista (Priority: P1) 🎯 MVP

**Goal**: botones, campos, selectores, casillas, diálogos, avisos, toast y foco con bordes de
tinta, sombra dura, esquinas casi rectas, tipografía gruesa y efecto pulsar.

**Independent Test**: abrir un tablero, recorrer con Tab botones, campos y el diálogo de una
tarea, provocar un error y un borrado con "Deshacer"; estilo aplicado, foco visible, efecto
pulsar, movimiento reducido sin animación y 0 violaciones de axe.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Write failing E2E `e2e/tests/visual-style.spec.ts` (desktop only, skip when `E2E_BASE_URL`): after `openBoard` and `document.fonts.ready`, `getComputedStyle(document.body).fontFamily` starts with `"Space Grotesk Variable"` and `document.fonts.check('500 16px "Space Grotesk Variable"')` is true; every response whose URL ends in `.woff2` has the page origin and their summed `content-length`/body size is ≤ 100 KB; no console message matches `/Content Security Policy/i`; the "Crear tarea" button has a computed `border-top-width` of `3px`, a `box-shadow` that is not `none` and a `border-radius` of `4px` (FR-001)
- [X] T006 [P] [US1] Add to `e2e/tests/a11y-responsive.spec.ts` a test "movimiento reducido: los botones no animan el desplazamiento (FR-007, SC-005)": with `page.emulateMedia({ reducedMotion: 'reduce' })` the computed `transition-duration` of "Crear tarea" is `0s` for every listed property; without it (new page) hovering the button changes its computed `transform` from `none` and its `transition-duration` includes `0.08s`. Fails now
- [X] T007 [P] [US1] Add to `e2e/tests/a11y-responsive.spec.ts` a test "foco visible y separado del borde (FR-008)": tab to "Crear tarea", a field (`Título`) and a filter checkbox; each has computed `outline-style: solid`, `outline-width: 3px` and `outline-offset: 3px`. Fails now (offset is 2px)

### Implementation for User Story 1

- [X] T008 [US1] Restyle `apps/web/src/ui/ui.css` per research R31/R33: `.btn` with `border: var(--border)` (3px; `box-sizing: border-box` keeps the 44 px box), `border-radius: var(--radius)`, `font-weight: 700`, `box-shadow: var(--shadow-sm)`, `transition: transform var(--press-duration), box-shadow var(--press-duration)`; `:hover:not(:disabled):not([aria-disabled='true'])` → `transform: translate(1px, 1px)` and `box-shadow: 1px 1px 0 var(--color-shadow)`; `:active` (same guards) → `translate(var(--shadow-offset-sm), var(--shadow-offset-sm))`, `box-shadow: none`; `:disabled` and `[aria-disabled='true']` → `box-shadow: none`, keep `opacity: 0.7` and `cursor: not-allowed`; `.btn--primary` → `background: var(--color-primary)`, `color: var(--color-on-primary)`, ink border; `.btn--danger` → `background: var(--color-danger)`, `color: var(--color-on-danger)`, ink border. `.alert` and `.toast` → `border: var(--border)`, `border-radius: var(--radius)`, `box-shadow: var(--shadow)` (`.toast` keeps `background: var(--color-text)`/`color: var(--color-bg)`); `.dialog` → `border: var(--border)`, `box-shadow: var(--shadow-lg)`, header with `border-bottom: var(--border)` and `font-weight: 700`. Move the `:focus-visible` rule from `tokens.css` here with `outline: 3px solid var(--color-focus); outline-offset: 3px`. Add `@media (forced-colors: active)` resetting `box-shadow: none` on `.btn`, `.alert`, `.toast`, `.dialog` and `outline-color: Highlight` on `:focus-visible` (FR-013)
- [X] T009 [US1] Restyle form controls in `apps/web/src/features/tasks/tasks.css` and `apps/web/src/features/filters/filters.css`: `.field__input` with `border: var(--border-sm)`, `border-radius: var(--radius)`, `box-shadow: var(--shadow-sm)`, invalid state keeps `border-color: var(--color-danger)` plus `--border-width` thickness (not only color, FR-009); `.field__label` `font-weight: 700`; `.create-task` and `.filters` as blocks with `border: var(--border)`, `box-shadow: var(--shadow)`, `border-radius: var(--radius)`; `.filters__check input` with `accent-color: var(--color-primary)`; `.no-results` with dashed `var(--border-width)` ink border; `.task-detail__confirm` with `border: var(--border)` in `--color-danger`; `.hidden-notice` with `border: var(--border-sm)`
- [X] T010 [US1] Run `npm test -w apps/web`, `npm run lint` and `npx playwright test tests/visual-style.spec.ts tests/a11y-responsive.spec.ts tests/security-headers.spec.ts` from `e2e/` (with `db-test` up): T005–T007 pass, existing a11y (light and dark), 44 px and 320 px assertions still pass

**Checkpoint**: US1 completa; el resto de pantallas ya usa botones, campos y diálogos nuevos.

---

## Phase 4: User Story 2 - Tablero con columnas por estado (Priority: P2)

**Goal**: columnas con acento por estado (siempre con su nombre), tarjetas como bloques con
borde y sombra, estados de arrastre, columna destino, "Guardando…" y pestañas móviles que se
distinguen sin color.

**Independent Test**: con tareas en los tres estados, acentos por columna, arrastrar con ratón
y con el asa por teclado, "Guardando…", a 1280 y 320 px, claro y oscuro, 0 violaciones.

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Add to `apps/web/tests/board/board.test.tsx` failing tests: with the wide layout each column `region` (by its heading "Pendiente", "En progreso", "Hecha") has class `column--pending`, `column--in_progress`, `column--done` respectively and keeps class `column`; with the narrow layout (tabs) each `tab` has `board-tabs__tab--<status>` and the `tabpanel` has `column column--tab column--<status>` of the selected tab, changing when another tab is selected. Follow the existing helpers of that file to switch layouts
- [X] T012 [P] [US2] Extend `e2e/tests/a11y-responsive.spec.ts` "modo oscuro" test: after the dialog, start a keyboard move on a card handle ("Mover «A»") so the destination column shows `column--drop-target`, run `expectNoA11yViolations`, `expectTapTargets` and `expectNoHorizontalScroll`, then cancel with Escape; and add the same three checks with a card in "Guardando…" state, obtained with `page.route('**/api/v1/tasks/*', …)` that waits 2 s before `route.continue()` while the status of «A» is changed with its select. Must pass on desktop and mobile-320 (on mobile, use `showColumn`)

### Implementation for User Story 2

- [X] T013 [US2] Add the status modifiers (presentation only, R32): in `apps/web/src/features/board/Column.tsx` build the class as `['column', `column--${status}`, dropTarget && 'column--drop-target']`; in `apps/web/src/features/board/BoardTabs.tsx` add `board-tabs__tab--${status}` to each tab button and `column--${current.status}` to the `tabpanel`. T011 passes
- [X] T014 [US2] Restyle `apps/web/src/features/board/board.css` per the contract and R32: `.column` with `border: var(--border)`, `border-radius: var(--radius)`, `box-shadow: var(--shadow)`, `background: var(--color-surface)`; `.column--pending|in_progress|done` set `--column-accent: var(--color-status-<estado>)` and `--column-soft: var(--color-status-<estado>-soft)` and use `background: var(--column-soft)`; `.column__header` as a band with `background: var(--column-accent)`, `color: var(--color-on-status)`, `border-bottom: var(--border)`, negative margins to span the padding; `.column__count` inherits `--color-on-status` (contrast ≥ 9.5:1); `.card` with `border: var(--border-sm)`, `box-shadow: var(--shadow-sm)`, `border-radius: var(--radius)`, no hover movement; `.card__title` `color: var(--color-primary)`, `font-weight: 700`; `.card__handle` and `.card__select` with `border: var(--border-sm)` and `.card__handle` with the press effect of `.btn`; `.card__handle[aria-pressed='true']` with `border: var(--border-width) solid var(--color-focus)`, `color: var(--color-text)` and `box-shadow: var(--shadow)` (thicker border + shadow, not only color); `.card--dragging` `opacity: 0.4` + dashed border; `.card--picked` `outline: 3px solid var(--color-focus); outline-offset: 3px`; `.card--overlay` `box-shadow: var(--shadow-lg)` and `transform: rotate(-2deg)` except under `prefers-reduced-motion: reduce`; `.column--drop-target` `outline: var(--border-width) dashed var(--color-focus); outline-offset: 3px` plus `box-shadow: var(--shadow-lg)`; a card whose `.card__saving` is shown keeps its text and gets a dashed border via `.card:has(.card__saving)`; `.board-tabs__tab--pending|in_progress|done` set `--column-accent` like the column modifiers; `.board-tabs__tab` with `border: var(--border-sm)`, no shadow when inactive, and `[aria-selected='true']` with `background: var(--column-accent)`, `color: var(--color-on-status)`, `border-width: var(--border-width)` and `box-shadow: var(--shadow-sm)`; `.column--tab` keeps `max-height: none`. Leave `box-shadow` space so nothing overflows at 320 px (`.board__columns` padding-inline-end ≥ `--shadow-offset` if needed)
- [X] T015 [US2] Run `npm test -w apps/web` and `npm run test:e2e` (full suite, `db-test` up): T011–T012 pass and all drag-and-drop, status, a11y, 44 px and 320 px tests of the 001/002 still pass without changing their expectations (SC-004)

**Checkpoint**: US2 completa; el tablero tiene el estilo completo.

---

## Phase 5: User Story 3 - Resto de pantallas y modo oscuro (Priority: P3)

**Goal**: inicio, enlace no válido, aviso del enlace nuevo, menú "Tablero", personas,
detalle de tarea y cabecera con el mismo estilo, y versión oscura verificada en todas.

**Independent Test**: recorrer inicio, enlace no válido, creación de tablero, menú "Tablero",
personas y detalle de tarea en claro y oscuro con 0 violaciones.

### Tests for User Story 3 ⚠️

- [X] T016 [P] [US3] Add to `e2e/tests/a11y-responsive.spec.ts` a `test.describe('modo oscuro en el resto de pantallas')` with `test.use({ colorScheme: 'dark' })`: home (`/`), invalid link (`/#k=incorrecto`), "Tablero" menu open, "Personas" dialog and task detail dialog each pass `expectNoA11yViolations`, `expectTapTargets` and `expectNoHorizontalScroll`, on desktop and mobile-320. Must pass before and after the restyle of T018–T019 (guards the dark palette)
- [X] T017 [P] [US3] Add to `e2e/tests/boards.spec.ts` dark-mode checks for the new-board link dialog (create a board with `colorScheme: 'dark'`, then `expectNoA11yViolations` and `expectNoHorizontalScroll` on the dialog) and assert the "Crear tablero" submit button has class `btn--primary` (FR-006)

### Implementation for User Story 3

- [X] T018 [P] [US3] Restyle `apps/web/src/app/app.css`, `apps/web/src/features/home/home.css` and `apps/web/src/features/access/access.css`: `.app-header` with `border-bottom: var(--border)` and title `font-weight: 700`; `.home` and `.invalid-link` as cards with `background: var(--color-surface)`, `border: var(--border)`, `box-shadow: var(--shadow)`, `border-radius: var(--radius)`; titles `font-weight: 700`; `.new-board__link` and `.share__link` with `font-family: var(--font-mono)` and `border: var(--border-sm)`; `.home__notice` with `border: var(--border-sm)`; `.board-menu__list` with `border: var(--border)`, `box-shadow: var(--shadow)` and `border-radius: var(--radius)` keeping its T057 positioning (`right`, `max-width`); warnings (`.board-settings__warning`, `.new-board__warning`) `font-weight: 700`. *Hecho*: `.home` e `.invalid-link` llevan además margen lateral `--space-4` por debajo de 34rem para que su sombra no se corte a 320 px
- [X] T019 [P] [US3] Restyle `apps/web/src/features/people/people.css` and the detail part of `apps/web/src/features/tasks/tasks.css`: `.people__row` with `border: var(--border-sm)` and `box-shadow: var(--shadow-sm)`; `.people__name` and `.task-detail__meta dd` `font-weight: 700`; `.task-detail__saving` and `.people__warning` unchanged in text, `font-weight: 700`
- [X] T020 [US3] Run `npm test -w apps/web` and `npm run test:e2e`: T016–T017 pass; all suites green

**Checkpoint**: todas las historias completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] Update `CLAUDE.md`: add feature 003 to "Estado del repositorio" (T001–T023, decisions D17–D18 of its `plan.md`), mention under "Arquitectura planificada" that colors/shapes live only in `apps/web/src/ui/tokens.css` (checked by `apps/web/tests/ui/tokens.test.ts`) and that the font is self-hosted with `@fontsource-variable/space-grotesk`
- [X] T022 Run the full gate: `npm run lint && npm run lint:deps && npm run typecheck && npm test && npm run test:e2e`; report results faithfully
- [ ] T023 Manual validation of `specs/003-neobrutalism-ui/quickstart.md` section 2 (scenarios 1–12, including grayscale SC-007, zoom 200 %, forced colors and blocked `woff2`); record the outcome and any defect (each defect gets a reproducing test before its fix). *Comprobación previa automatizada (2026-10-17, escritorio)*: escenarios 8 (acromatopsia emulada: estados por su nombre y "Guardando…" por texto y borde discontinuo), 9 (640 px ≈ zoom 200 %: sin desplazamiento horizontal), 10 (`forced-colors: active`: bordes y foco visibles, sin sombras) y 11 (`woff2` bloqueados: texto inmediato con la fuente del sistema) correctos. Pendiente la validación manual completa

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001 (T004). T002 → T003; T004 tras T001. **Bloquea
  todas las historias.**
- **US1 (Phase 3)**: depende de Foundational. T008 antes de T014 y T018 (efecto pulsar y foco
  que reutilizan asa y pestañas).
- **US2 (Phase 4)**: depende de Foundational; usa el efecto de `.btn` de T008.
- **US3 (Phase 5)**: depende de Foundational y de T008–T009 (botones y campos).
- **Polish (Phase 6)**: depende de todo lo anterior.

### User Story Dependencies

- **US1 (P1)**: ninguna.
- **US2 (P2)**: T008 (efecto pulsar compartido).
- **US3 (P3)**: T008–T009; `tasks.css` lo tocan T009 (campos) y T019 (detalle) en ese orden.

### Within Each User Story

- Pruebas primero (deben fallar, salvo las que protegen lo existente), luego marcado → estilos
  → ejecución de la batería.
- Una tarea se marca `[X]` solo cuando sus pruebas se han ejecutado y pasan.
- No ejecutar los E2E a la vez que las pruebas de `apps/api` (misma BD).

### Parallel Opportunities

- Foundational: T002 en paralelo con T001.
- US1: T005, T006 y T007 en paralelo (T006 y T007 tocan el mismo archivo: escribir en orden si
  se hace a mano).
- US2: T011 y T012 en paralelo.
- US3: T016 y T017 en paralelo; T018 y T019 en paralelo.

---

## Parallel Example: User Story 1

```bash
Task: "T005 E2E de tipografía, CSP y forma en e2e/tests/visual-style.spec.ts"
Task: "T006 movimiento reducido en e2e/tests/a11y-responsive.spec.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T018 cabecera, inicio y acceso en app.css, home.css y access.css"
Task: "T019 personas y detalle en people.css y tasks.css"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 + Phase 2: tokens y tipografía (la interfaz cambia de paleta y fuente).
2. US1: componentes base. **Parar y validar** con el quickstart (escenarios 2, 3, 6, 11).

### Incremental Delivery

Un PR por fase, como en la 001/002, con un commit por capa (dependencias → pruebas → estilos/
marcado → docs): `pr/NN-003-base` (Phases 1–2), `pr/NN-003-us1-base-visual`,
`pr/NN-003-us2-tablero`, `pr/NN-003-us3-pantallas`, `pr/NN-003-acabado` (Phase 6). Cada PR con
`npm test` y `npm run test:e2e` en verde.

---

## Notes

- [P] = archivos distintos, sin dependencias de tareas incompletas.
- Ningún cambio en `packages/*` ni `apps/api`; `npm run lint:deps` debe seguir en verde.
- Los nombres accesibles, textos y orden del DOM no cambian: si una prueba existente falla,
  es un defecto del estilo, no de la prueba.
