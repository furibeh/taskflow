# Contrato de estilo: tokens y modificadores

**Plan**: [plan.md](../plan.md) | **Research**: R29–R33

Interfaz pública del estilo. `apps/web/src/ui/tokens.css` es el único archivo con valores de
color; el resto de hojas solo usa `var(--…)`. `apps/web/tests/ui/tokens.test.ts` comprueba la
tabla de contrastes de este documento.

## Tokens de color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#fdf6e3` | `#121214` | Fondo de página |
| `--color-surface` | `#ffffff` | `#1e1e23` | Tarjetas, campos, diálogos, cabecera |
| `--color-text` | `#111111` | `#f7f2e7` | Texto |
| `--color-text-muted` | `#3f3f46` | `#cdc6b8` | Texto secundario |
| `--color-border` | `#111111` | `#f7f2e7` | Bordes de tinta |
| `--color-shadow` | `#111111` | `#f7f2e7` | Sombra dura |
| `--color-primary` | `#6d3df5` | `#b9a3ff` | Acción principal, enlaces de título |
| `--color-on-primary` | `#ffffff` | `#111111` | Texto sobre primario |
| `--color-danger` | `#c2142b` | `#ff8f99` | Peligro y errores (texto y fondo de botón) |
| `--color-on-danger` | `#ffffff` | `#111111` | Texto sobre peligro |
| `--color-danger-bg` | `#ffe1e5` | `#3d1419` | Avisos de error, confirmaciones de borrado |
| `--color-success-bg` | `#d9f7e6` | `#12301f` | Avisos informativos |
| `--color-focus` | `#0a5cff` | `#7cc4ff` | Indicador de foco, columna destino |
| `--color-backdrop` | `rgb(17 17 17 / 0.6)` | `rgb(0 0 0 / 0.7)` | Fondo del diálogo |
| `--color-on-status` | `#111111` | `#111111` | Texto sobre acento de estado |
| `--color-status-pending` | `#ffd23f` | `#ffd23f` | Pendiente (amarillo) |
| `--color-status-in_progress` | `#3ec7f2` | `#3ec7f2` | En progreso (cian) |
| `--color-status-done` | `#3ddc97` | `#3ddc97` | Hecha (verde) |
| `--color-status-pending-soft` | `#fff1bf` | `#3a3115` | Fondo de columna Pendiente |
| `--color-status-in_progress-soft` | `#d6f3fc` | `#10303b` | Fondo de columna En progreso |
| `--color-status-done-soft` | `#d4f7e7` | `#123326` | Fondo de columna Hecha |

## Tokens de forma y movimiento

| Token | Valor | Uso |
|---|---|---|
| `--font` | `'Space Grotesk Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | Todo el texto |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, monospace` | Enlaces secretos |
| `--border-width` | `3px` (`2px` en campos y casillas: `--border-width-sm`) | Bordes |
| `--radius` | `4px` | Esquinas casi rectas |
| `--shadow-offset` / `--shadow-offset-sm` | `4px` / `2px` | Sombra dura (tarjetas, diálogos / controles) |
| `--shadow`, `--shadow-sm` | `<offset> <offset> 0 var(--color-shadow)` | Sin desenfoque |
| `--press-duration` | `80ms` (`0s` con `prefers-reduced-motion: reduce`) | Efecto pulsar |
| `--tap-size`, `--space-*` | sin cambios | 44 px y espaciado |

## Modificadores de componentes

| Clase | Elemento | Estados que debe distinguir sin color |
|---|---|---|
| `column--pending`, `column--in_progress`, `column--done` | `<section>` de `Column.tsx` y panel de `BoardTabs.tsx` | Nombre del estado siempre visible en la cabecera o en la pestaña |
| `board-tabs__tab--<estado>` | Pestañas de `BoardTabs.tsx` | Activa: borde grueso + sombra; inactiva: sin sombra |
| `column--drop-target` (existente) | Columna destino | Borde discontinuo grueso |
| `card--dragging`, `card--picked`, `card--overlay` (existentes) | Tarjeta | Opacidad / contorno / sombra mayor |
| `.btn:disabled`, `[aria-disabled='true']` (existentes) | Botones | Sin sombra ni desplazamiento |

## Tabla de contrastes (medida el 2026-10-17)

Umbrales: texto ≥ 4,5:1; bordes, foco y elementos gráficos ≥ 3:1.

| Par | Claro | Oscuro |
|---|---|---|
| text / bg | 17,51 | 16,76 |
| text / surface | 18,88 | 14,87 |
| text-muted / bg | 9,68 | 11,02 |
| text-muted / surface | 10,44 | 9,77 |
| border / bg y surface | 17,51 / 18,88 | 16,76 / 14,87 |
| on-primary / primary | 5,78 | 8,76 |
| primary / surface y bg | 5,78 / 5,35 | 7,70 / 8,68 |
| danger / surface y bg | 6,12 / 5,68 | 7,62 / 8,59 |
| on-danger / danger | 6,12 | 8,67 |
| text / danger-bg; danger / danger-bg | 15,42 / 5,00 | 14,33 / 7,35 |
| text / success-bg | 16,54 | 12,81 |
| focus / bg y surface | 4,88 / 5,27 | 9,98 / 8,85 |
| on-status / status (pending, in_progress, done) | 13,08 / 9,58 / 10,68 | igual |
| text / status-*-soft (mín.) | 16,26 | 11,54 |
| text-muted / status-*-soft (mín.) | 8,99 | 7,59 |
| border / status-*-soft (mín.) | 16,26 | 11,54 |
| focus / status-*-soft (mín.) | 4,54 | 6,87 |
| primary / status-*-soft (mín.) | 4,97 | 5,98 |
