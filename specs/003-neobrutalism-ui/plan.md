# Implementation Plan: Estilo visual neobrutalista

**Branch**: `003-neobrutalism-ui` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-neobrutalism-ui/spec.md`

## Summary

La interfaz web adopta un estilo neobrutalista (bordes gruesos de tinta, sombras duras sin
desenfoque, colores planos saturados, tipografía geométrica gruesa, esquinas casi rectas) en
modo claro y oscuro, sin cambiar textos, nombres accesibles, flujos ni comportamiento.

Enfoque técnico: todo el cambio vive en `apps/web`. Se reescribe el conjunto de tokens de
`apps/web/src/ui/tokens.css` (paleta medida para WCAG AA en ambos modos, grosores, sombra dura,
radios, tipografía, movimiento) y los CSS existentes pasan a consumir solo tokens. Se añade la
tipografía Space Grotesk autoalojada con `@fontsource-variable/space-grotesk` (servida por Vite
desde el propio origen, compatible con la CSP actual). La columna, su pestaña móvil y su panel
reciben un modificador por estado (`column--pending|in_progress|done`) para el acento de
color. Pruebas primero: una prueba de contraste que lee `tokens.css` (SC-002), pruebas de
componentes de los modificadores por estado y E2E de axe/44 px/320 px también en oscuro y con
movimiento reducido. Detalle y alternativas en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), CSS (sin preprocesador); sin cambios

**Primary Dependencies**: las de la 001/002. **Nueva** (web, runtime):
`@fontsource-variable/space-grotesk` 5.x (OFL-1.1), solo CSS + `woff2` (D17)

**Storage**: N/A (sin cambios de esquema ni migraciones)

**Testing**: Vitest + Testing Library + axe-core en `apps/web` (componentes y prueba de
contraste de tokens); Playwright + axe en `e2e/` (desktop y mobile-320, ahora también con
`colorScheme: 'dark'` y `reducedMotion: 'reduce'`)

**Target Platform**: navegadores modernos (los de la 001)

**Project Type**: aplicación web (SPA + API REST) en monorepo; solo cambia la SPA

**Performance Goals**: SC-003 de la 001 se mantiene (< 1 s con 200 tareas); la tipografía
añade ≤ 100 KB transferidos (SC-006) y no bloquea el primer pintado (`font-display: swap`)

**Constraints**: WCAG 2.1 AA en claro y oscuro; objetivos ≥ 44 px; sin scroll horizontal a
320 px; CSP de producción sin cambios (`default-src 'self'`, `style-src 'self'`, sin estilos
inline); sin lógica en la web

**Scale/Scope**: 9 hojas de estilo (`ui/tokens.css`, `ui/ui.css`, `app/app.css` y 6 de
`features/*`), 2 componentes con una clase nueva (`Column.tsx`, `BoardTabs.tsx`), `main.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Código modular | Los tokens son la interfaz pública del estilo (`ui/tokens.css`); cada `features/*/*.css` solo consume tokens (D18). `apps/web` no gana dependencias de otras capas (`lint:deps`) | ✅ |
| II. Dominio independiente de la interfaz | Cambio solo de presentación; dominio, contratos y API intactos. El modificador por estado se deriva del `status` que ya recibe la columna, sin reglas nuevas | ✅ |
| III. Validación de toda entrada | No hay entradas nuevas | ✅ N/A |
| IV. Pruebas de operaciones importantes | Las pruebas existentes (001/002) deben seguir pasando sin cambiar expectativas (SC-004); nuevas: contraste de tokens, modificadores por estado, axe/44 px/320 px en oscuro, movimiento reducido, carga de la tipografía sin violaciones de CSP | ✅ |
| V. Secretos fuera del repositorio | Sin configuración nueva | ✅ N/A |
| VI. Migraciones | Sin cambios de esquema | ✅ N/A |
| Seguridad y datos | CSP sin cambios: la fuente se sirve desde `'self'`. Nueva dependencia de runtime revisada (licencia OFL, sin JS, `npm audit`) | ✅ (D17) |
| Definición de terminado | `npm test` + `npm run test:e2e` en verde para cerrar cada tarea | ✅ |
| Explicar decisiones de arquitectura/seguridad antes de aplicarlas | Sección **Decisiones que requieren aprobación** (D17–D18) | ✅ Aprobadas por el usuario el 2026-10-17 |

**Resultado**: sin violaciones. Decisiones D17 y D18 aprobadas por el usuario el 2026-10-17;
la puerta queda abierta para `/speckit-tasks` y `/speckit-implement`.

**Re-evaluación tras la Fase 1** (contrato de tokens, quickstart): sin cambios. No hay modelo
de datos ni contrato HTTP nuevos; el contrato de la API vigente sigue siendo
`specs/002-multiple-boards/contracts/openapi.yaml`.

## Arquitectura del estilo

```text
@fontsource-variable/space-grotesk ──(import en main.tsx, Vite la empaqueta en /assets)──┐
                                                                                          ▼
ui/tokens.css   :root { paleta clara, --border-*, --shadow-*, --radius, --font, --press-* }
                @media (prefers-color-scheme: dark) { paleta oscura }
                @media (prefers-reduced-motion: reduce) { --press-duration: 0s }
                @media (forced-colors: active) { sin sombras; bordes del sistema }
      │  (solo var(--…); ningún color literal fuera de tokens.css)
      ▼
ui/ui.css       .btn (+ efecto pulsar) · .alert · .dialog · .toast · foco · campos base
app/app.css     cabecera, página, enlace no válido
features/*/…    tablero (columnas por estado, tarjetas, arrastre, pestañas), tareas,
                filtros, personas, inicio, acceso/menú "Tablero"
```

Clases nuevas en componentes (únicos cambios en TSX):

| Componente | Clase añadida | Uso |
|---|---|---|
| `features/board/Column.tsx` | `column--${status}` en la `<section>` | Acento y fondo suave de la columna |
| `features/board/BoardTabs.tsx` | `board-tabs__tab--${status}` en cada pestaña y `column--${status}` en el panel | Acento de la pestaña; pestaña activa con borde grueso + sombra, no solo color |

Valores concretos y tabla de contrastes: [contracts/ui-tokens.md](./contracts/ui-tokens.md).

## Decisiones que requieren aprobación

Según la constitución, estas decisiones se explican aquí antes de aplicarse.
**Aprobadas por el usuario el 2026-10-17.** D1–D16 siguen vigentes.

| # | Tipo | Decisión | Problema que resuelve | Alternativas descartadas | Impacto / riesgo |
|---|---|---|---|---|---|
| D17 | SEG/ARQ | **Tipografía Space Grotesk autoalojada** con `@fontsource-variable/space-grotesk` (OFL-1.1, solo CSS y `woff2`, sin JS), importada en `main.tsx`; Vite copia los `woff2` a `/assets` y la CSP actual (`default-src 'self'`) la cubre sin cambios. `font-display: swap` y pila de reserva del sistema (R28) | FR-010 y la clarificación "tipografía propia servida desde TaskFlow" | Google Fonts/CDN (abre la CSP a un tercero y envía la IP de cada visitante); copiar los `woff2` a mano (sin actualizaciones vía npm ni `npm audit`); solo fuentes del sistema (rechazado por el usuario) | Primera dependencia de runtime de la web que no es JS: ~20–40 KB por subconjunto (latín y latín ampliado, cargados por `unicode-range`); se revisa con `npm audit` como el resto |
| D18 | ARQ | **Conjunto único de tokens neobrutalistas** en `ui/tokens.css` como única fuente de colores, grosores, sombras, radios, tipografía y movimiento; ningún color literal en otras hojas (lo verifica una prueba) y tabla de contrastes comprobada automáticamente en ambos modos (R29, R30) | FR-002, FR-004, SC-002 | Paleta por hoja de estilo (deriva y contrastes sin verificar); librería CSS neobrutalista o Tailwind (dependencia y reescritura del marcado sin necesidad); variables en TS/CSS-in-JS (incompatible con `style-src 'self'` sin `unsafe-inline`) | Cambia el aspecto de todas las pantallas a la vez; las pruebas funcionales no dependen de estilos, pero el contraste real solo lo mide axe en los E2E |

Decisiones sin impacto de arquitectura ni seguridad (no requieren aprobación aparte):
efecto pulsar y movimiento reducido (R31), modificadores por estado (R32), foco y colores
forzados (R33), estrategia de pruebas (R34).

**Fuera de alcance**: selector de tema manual, temas por tablero, iconos o ilustraciones
nuevas, cambios de textos.

## Project Structure

### Documentation (this feature)

```text
specs/003-neobrutalism-ui/
├── plan.md              # Este archivo
├── research.md          # Fase 0: R28–R34
├── quickstart.md        # Fase 1: validación visual y automática
├── contracts/
│   └── ui-tokens.md     # Fase 1: tokens, modificadores y tabla de contrastes
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Fase 2 (/speckit-tasks)
```

Sin `data-model.md`: la feature no introduce ni modifica entidades.

### Source Code (repository root)

```text
CLAUDE.md                                      ～ feature 003, D17–D18
apps/web/package.json, package-lock.json       ～ @fontsource-variable/space-grotesk
apps/web/src/
├── main.tsx                                   ～ import de la tipografía (antes de tokens.css)
├── ui/tokens.css                              ～ paleta neobrutalista clara/oscura y tokens nuevos
├── ui/ui.css                                  ～ botones (pulsar), avisos, diálogo, toast, foco
├── app/app.css                                ～ cabecera, enlace no válido
└── features/
    ├── board/{board.css,Column.tsx,BoardTabs.tsx}  ～ acentos por estado, tarjetas, arrastre, pestañas
    ├── tasks/tasks.css                        ～ campos, formulario, detalle
    ├── filters/filters.css, people/people.css ～
    └── home/home.css, access/access.css       ～ inicio, aviso del enlace, menú "Tablero"
apps/web/tests/
├── ui/tokens.test.ts                          ＋ contrastes de la tabla (claro y oscuro), sin colores literales fuera de tokens
└── board/board.test.tsx                       ～ modificadores por estado en columnas y pestañas
e2e/tests/
├── a11y-responsive.spec.ts                    ～ axe/44 px/320 px también en oscuro; movimiento reducido
├── boards.spec.ts                            ～ aviso del enlace nuevo en oscuro; botón primario
└── visual-style.spec.ts                       ＋ tipografía desde el propio origen, cargada y ≤ 100 KB; sin violaciones CSP
```

**Structure Decision**: se mantiene la estructura de la web; no se crean carpetas nuevas de
código. Los tokens siguen en `ui/` y cada feature conserva su hoja de estilo.

## Complexity Tracking

Sin excepciones a la constitución.
