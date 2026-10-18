# Quickstart: Validación del estilo neobrutalista

**Plan**: [plan.md](./plan.md) | **Contrato de estilo**: [contracts/ui-tokens.md](./contracts/ui-tokens.md)

Guía para comprobar la feature 003 tras `/speckit-implement`. Requisitos previos y
configuración: `specs/001-kanban-task-board/quickstart.md` (secciones 1–3). No hay variables
ni migraciones nuevas.

## 1. Pruebas automatizadas

```bash
npm ci
npm run lint && npm run lint:deps && npm run typecheck
docker compose up -d db-test
npm test               # incluye tokens.test.ts (contrastes y sin colores literales)
npm run test:e2e       # axe/44 px/320 px en claro y oscuro, movimiento reducido, tipografía y CSP
```

Resultado esperado: todo en verde, incluidas las pruebas de la 001 y la 002 sin cambios en sus
expectativas (SC-004).

## 2. Revisión visual

`docker compose up --build` y abrir el enlace del tablero en `http://localhost:5173` con
tareas en los tres estados.

| # | Escenario | Resultado esperado | Requisitos |
|---|---|---|---|
| 1 | Tablero en claro a 1280 px | Fondo crema, bordes de tinta de 3 px, sombras duras, Space Grotesk; columnas amarilla/cian/verde con su nombre | FR-001, FR-005 |
| 2 | Pasar el puntero y pulsar "Crear tarea" | El botón se hunde sobre su sombra y vuelve al soltar | FR-007 |
| 3 | Recorrer con Tab cabecera, formulario, filtros y una tarjeta | Contorno azul separado del borde en todos los controles | FR-008 |
| 4 | Arrastrar una tarjeta (ratón) y moverla con el asa (teclado) | Tarjeta arrastrada con sombra mayor; columna destino con borde discontinuo; "Guardando…" visible | FR-009 |
| 5 | Sistema en modo oscuro (o DevTools → Rendering → `prefers-color-scheme: dark`) | Fondo casi negro, bordes y sombras crema en todas las pantallas; cambia sin recargar | FR-003 |
| 6 | DevTools → `prefers-reduced-motion: reduce` y pulsar botones | Cambio instantáneo, sin desplazamiento animado | FR-007, SC-005 |
| 7 | Ancho 320 px: tablero con pestañas, diálogo de tarea, menú "Tablero", inicio | Sin scroll horizontal; pestaña activa con borde y sombra | FR-011 |
| 8 | DevTools → Rendering → "Emulate vision deficiencies: Achromatopsia" | Se identifica el estado de cada columna y la tarjeta "Guardando…" sin color | SC-007 |
| 9 | Zoom 200 % | Sin contenido cortado | Edge cases |
| 10 | DevTools → `forced-colors: active` | Controles delimitados por bordes y foco visible | FR-013 |
| 11 | DevTools → Network: bloquear `*.woff2` y recargar | Texto visible al instante con la fuente del sistema | FR-010 |
| 12 | Inicio, enlace no válido (`/#k=incorrecto`), crear tablero y aviso del enlace | Mismo estilo; acción principal en violeta; "Borrar" en rojo con texto | FR-006 |
