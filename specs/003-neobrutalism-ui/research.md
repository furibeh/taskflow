# Research: Estilo visual neobrutalista

**Fecha**: 2026-10-17 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Continúa la numeración de `specs/002-multiple-boards/research.md` (R18–R27). Formato
Decisión / Justificación / Alternativas. Las marcadas **[ARQ]** o **[SEG]** requieren
aprobación explícita antes de implementarse.

Punto de partida verificado en el código:

- Los colores ya se centralizan en `apps/web/src/ui/tokens.css` (claro + oscuro con
  `prefers-color-scheme`), pero las hojas usan `1px solid`, `--radius: 8px` y algunos
  literales (`rgb(0 0 0 / 0.45)` del fondo del diálogo, sombras del toast y de la tarjeta
  arrastrada).
- La CSP de producción (`apps/web/vite.config.ts`) es `default-src 'self'` sin `font-src`
  propio, y `style-src 'self'`: cualquier fuente o hoja servida desde el origen está permitida;
  nada de terceros ni estilos inline.
- La columna (`Column.tsx`) y las pestañas (`BoardTabs.tsx`) conocen su `status`
  (`pending | in_progress | done`) pero no lo exponen como clase.
- Los E2E ya auditan con axe (`e2e/tests/support/board.ts`, `expectNoA11yViolations`), miden
  44 px y el scroll horizontal (`a11y-responsive.spec.ts`) y vigilan la CSP
  (`security-headers.spec.ts`), solo en modo claro. Las pruebas de componentes desactivan
  `color-contrast` (jsdom no lo evalúa).

---

## R28. Tipografía autoalojada **[SEG/ARQ]** (D17)

- **Decisión**: `@fontsource-variable/space-grotesk` (5.x, OFL-1.1) importado en
  `apps/web/src/main.tsx` antes de `tokens.css`. El paquete trae `@font-face` con
  `font-display: swap` y `unicode-range` por subconjunto; Vite emite los `woff2` con hash en
  `/assets`, servidos desde el origen. `--font: 'Space Grotesk Variable', system-ui, …` (la
  pila actual queda de reserva). Pesos usados: 500 (texto), 700 (botones, títulos).
- **Justificación**: es la tipografía de referencia del estilo (geométrica, con carácter en
  pesos altos), variable (un archivo por subconjunto para todos los pesos) y con licencia que
  permite autoalojarla. La CSP no cambia y no se filtra la IP a terceros.
- **Alternativas**: Google Fonts (CSP y privacidad); `woff2` copiados al repo (sin
  actualizaciones ni auditoría por npm); Archivo/Lexend/Public Sans (válidas, menos
  identificables con el estilo); solo fuentes del sistema (descartado por el usuario).

## R29. Paleta y tokens **[ARQ]** (D18)

- **Decisión**: tokens semánticos (mismos nombres en claro y oscuro) más tokens de forma:
  - Color: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`,
    `--color-border` (tinta), `--color-shadow`, `--color-primary`, `--color-on-primary`,
    `--color-danger`, `--color-on-danger`, `--color-danger-bg`, `--color-success-bg`,
    `--color-focus`, `--color-backdrop`, y por estado `--color-status-<estado>` (acento
    saturado, siempre con texto `--color-on-status`) y `--color-status-<estado>-soft` (fondo
    de columna).
  - Forma: `--border-width: 3px`, `--border: var(--border-width) solid var(--color-border)`,
    `--radius: 4px`, `--shadow-offset: 4px` (`--shadow-offset-sm: 2px` en controles
    pequeños), `--shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--color-shadow)`,
    `--press-duration: 80ms`.
  - Valores y contrastes medidos en [contracts/ui-tokens.md](./contracts/ui-tokens.md).
- **Justificación**: un único punto de cambio (FR-002) y contrastes comprobables (SC-002).
  Fondo crema/tinta en claro y casi negro/crema en oscuro es el canon neobrutalista; los
  acentos de estado se usan como fondo con texto de tinta (≥ 9,5:1 en ambos modos), por eso
  pueden ser los mismos en claro y oscuro.
- **Alternativas**: acentos distintos por modo (más tokens sin ganancia de contraste);
  Tailwind o librería neobrutalista (dependencia y reescritura del marcado).

## R30. Verificación automática de contrastes y de tokens

- **Decisión**: `apps/web/tests/ui/tokens.test.ts` lee `tokens.css` con `node:fs`, extrae los
  valores de `:root` y del bloque oscuro y comprueba la tabla de pares de
  `contracts/ui-tokens.md` (texto ≥ 4,5:1, UI ≥ 3:1). La misma prueba falla si alguna hoja de
  `apps/web/src` distinta de `tokens.css` contiene un color literal (`#…`, `rgb(`, `hsl(`).
  Los E2E ejecutan axe con `color-contrast` en ambos modos sobre el DOM real.
- **Justificación**: jsdom no calcula contraste; la prueba de tokens da un fallo rápido y
  explícito al cambiar la paleta y axe cubre combinaciones reales.
- **Alternativas**: solo axe en E2E (lento y no cubre estados que no se ven en las pruebas);
  `stylelint` con regla de colores (otra herramienta para una sola regla).

## R31. Efecto "pulsar" y movimiento reducido

- **Decisión**: elementos con sombra (`.btn`, `.card__handle`, pestañas) en reposo con
  `box-shadow: var(--shadow-sm)`; en `:hover` se desplazan `translate(1px, 1px)` con sombra
  menor y en `:active` `translate(var(--shadow-offset-sm), …)` sin sombra. Transición de
  `transform` y `box-shadow` con `--press-duration`, que vale `0s` bajo
  `prefers-reduced-motion: reduce`. Deshabilitados y `aria-disabled` sin sombra ni
  desplazamiento (se distinguen por algo más que el color, FR-009). Las tarjetas no se
  desplazan al pasar el puntero (contienen controles y se arrastran).
- **Justificación**: el desplazamiento cabe dentro de la sombra, así que no mueve el diseño ni
  provoca scroll; `box-shadow` no cuenta para el desbordamiento.
- **Alternativas**: animaciones con `@keyframes` (más movimiento del necesario); sin efecto
  (descartado por el usuario).

## R32. Acento por estado en columnas y pestañas

- **Decisión**: `Column.tsx` añade `column--${status}`; `BoardTabs.tsx` añade
  `board-tabs__tab--${status}` a cada pestaña y `column--${status}` al panel. La columna usa
  `--color-status-<estado>-soft` de fondo, borde de tinta y una cabecera con
  `--color-status-<estado>` y texto `--color-on-status`. La pestaña activa usa el acento,
  borde grueso y sombra; las inactivas, superficie sin sombra (diferencia no solo cromática).
  La columna destino al soltar: borde discontinuo grueso `--color-focus` y sombra; la
  tarjeta arrastrada: sombra mayor; la tarjeta "Guardando…" conserva su texto y pasa a borde
  discontinuo.
- **Justificación**: FR-005 y FR-009 con un cambio mínimo de marcado; el valor del estado ya
  está en las props.
- **Alternativas**: `data-status` + selectores de atributo (equivalente; las clases siguen la
  convención BEM del proyecto); acento en cada tarjeta (ruido visual; la tarjeta ya muestra su
  estado en el selector).

## R33. Foco y colores forzados

- **Decisión**: `:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px }`
  (separado del borde de tinta por el desplazamiento; azul ≥ 4,5:1 sobre los fondos) y, en
  elementos con sombra, la sombra se mantiene. Bajo `forced-colors: active`, las sombras
  desaparecen (`box-shadow: none`) y los bordes usan `CanvasText`/`ButtonText`; el foco usa
  `Highlight`.
- **Justificación**: FR-008 y FR-013; el borde ya delimita cada control sin la sombra.
- **Alternativas**: anillo doble con `box-shadow` (choca con la sombra dura).

## R34. Estrategia de pruebas

- **Decisión**:
  1. Pruebas existentes de web y E2E sin cambiar expectativas (SC-004).
  2. `tokens.test.ts` (R30).
  3. `board.test.tsx`: columnas y pestañas llevan su modificador de estado.
  4. `a11y-responsive.spec.ts`: las comprobaciones de axe, 44 px y 320 px se repiten en un
     `describe` con `test.use({ colorScheme: 'dark' })`; una prueba con
     `reducedMotion: 'reduce'` comprueba que un botón no tiene transición de `transform`.
  5. `visual-style.spec.ts`: la familia calculada del cuerpo es Space Grotesk tras
     `document.fonts.ready`, todos los `woff2` vienen del propio origen, suman ≤ 100 KB y no
     hay violaciones de CSP (en escritorio; el servidor de desarrollo de los E2E sirve los
     `woff2` desde el mismo origen que la compilación).
  6. Validación manual del quickstart (escala de grises, zoom 200 %, colores forzados).
- **Justificación**: SC-001–SC-007 quedan cubiertos de forma automática salvo SC-007 (manual).
