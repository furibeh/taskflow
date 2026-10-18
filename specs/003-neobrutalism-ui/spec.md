# Feature Specification: Estilo visual neobrutalista

**Feature Branch**: `003-neobrutalism-ui`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Quiero que el sistema adopte un estilo en la UI de Neobrutalism.
Bordes negros gruesos, sombras duras desplazadas sin desenfoque, colores planos saturados,
tipografía gruesa y esquinas casi rectas en toda la interfaz web, manteniendo la accesibilidad,
el modo oscuro y el comportamiento actuales."

## Clarifications

### Session 2026-10-17

- Q: ¿Se mantiene el modo oscuro? → A: Sí. Hay una versión oscura neobrutalista (fondo casi
  negro, bordes y sombras claras, acentos ajustados para cumplir el contraste) que se aplica
  según la preferencia del sistema, como hoy.
- Q: ¿Qué tipografía se usa? → A: Una tipografía propia de estilo geométrico y grueso, servida
  desde el propio TaskFlow (sin servicios de terceros ni cambios en la política de seguridad
  de contenido). Si no carga, se usa la del sistema sin bloquear la lectura.
- Q: ¿Qué paleta? → A: Color de acento por estado (Pendiente amarillo, En progreso cian/azul,
  Hecha verde), un color primario fuerte para la acción principal y rosa/rojo para acciones
  peligrosas y errores. El color siempre acompaña a un texto; nunca transmite información solo.
- Q: ¿Hay animación al pulsar? → A: Sí. Botones y tarjetas interactivas se "hunden" sobre su
  sombra al pasar el puntero o pulsar; con la preferencia de movimiento reducido el cambio es
  instantáneo, sin desplazamiento animado.

**Relación con las features 001 y 002**: esta especificación solo cambia la **apariencia** de
la interfaz web. No cambia ningún requisito funcional, texto, flujo, contrato ni dato de la
001 ni de la 002. Se aplican sin cambios, y deben seguir cumpliéndose, FR-031 (WCAG 2.1 AA),
FR-033 (objetivos táctiles de 44 px y uso desde 320 px) y la política de seguridad de contenido
de la 001.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sistema visual base neobrutalista (Priority: P1)

Un miembro del equipo abre TaskFlow y percibe una identidad visual neobrutalista coherente en
todos los elementos comunes: fondo de color plano, botones, campos de texto, selectores,
casillas, diálogos, avisos de error y el aviso inferior ("Deshacer") con bordes gruesos de
alto contraste, sombra dura desplazada, esquinas casi rectas y tipografía gruesa. Los botones
se hunden sobre su sombra al pulsarlos. El foco del teclado se ve claramente y no se confunde
con los bordes.

**Why this priority**: es la base que reutilizan todas las pantallas; sin ella el resto de
historias no tiene vocabulario visual común y cualquier pantalla sola ya cambia de aspecto.

**Independent Test**: abrir un tablero, recorrer con Tab los botones, campos y un diálogo
(crear tarea), provocar un error de guardado y un borrado con "Deshacer", y comprobar el
estilo, el foco visible, el efecto al pulsar y 0 violaciones en la revisión automática de
accesibilidad.

**Acceptance Scenarios**:

1. **Given** un tablero abierto, **When** se mira cualquier botón, campo, diálogo, aviso de
   error o aviso inferior, **Then** tiene borde grueso de alto contraste, sombra dura sin
   desenfoque, esquinas casi rectas y la tipografía del estilo.
2. **Given** un botón, **When** se pasa el puntero o se pulsa, **Then** se desplaza hacia su
   sombra (que se reduce) y vuelve al soltar; con movimiento reducido el cambio no se anima.
3. **Given** navegación por teclado, **When** un control recibe el foco, **Then** muestra un
   indicador de foco con contraste ≥ 3:1 frente a lo que lo rodea y distinguible del borde del
   control.
4. **Given** la tipografía propia no carga, **When** se abre la página, **Then** el texto se
   muestra de inmediato con la tipografía del sistema y la interfaz sigue siendo usable.
5. **Given** un botón deshabilitado o en estado "Guardando…", **When** se mira, **Then** se
   distingue del habilitado por algo más que el color (p. ej., sin sombra o con texto).

---

### User Story 2 - Tablero con columnas por estado (Priority: P2)

Un miembro del equipo ve las tres columnas (Pendiente, En progreso, Hecha) con un color de
acento propio cada una, siempre junto al nombre del estado. Las tarjetas son bloques con borde
grueso y sombra dura; la tarjeta que se arrastra, la columna destino al soltar y la tarjeta
"Guardando…" se distinguen claramente. En móvil (pestañas por columna) la pestaña activa
también se distingue por algo más que el color.

**Why this priority**: el tablero es la pantalla principal y donde el estilo aporta más
(lectura rápida del estado), pero depende de la base de la US1.

**Independent Test**: con tareas en las tres columnas, comprobar los acentos por estado,
arrastrar una tarjeta (con ratón y con el modo de teclado), ver la columna destino resaltada y
el estado "Guardando…", a 1280 px y a 320 px, en claro y oscuro, sin violaciones de
accesibilidad.

**Acceptance Scenarios**:

1. **Given** tareas en los tres estados, **When** se ve el tablero, **Then** cada columna
   muestra su color de acento junto a su nombre y su recuento, y cada tarjeta indica su estado
   con texto además del color.
2. **Given** una tarjeta arrastrándose, **When** pasa sobre una columna, **Then** la tarjeta y
   la columna destino se distinguen por borde/sombra además del color.
3. **Given** una tarjeta en estado "Guardando…", **When** se ve, **Then** se distingue del resto
   y conserva el texto "Guardando…".
4. **Given** una pantalla de 320 px, **When** se ve el tablero con pestañas, **Then** no hay
   desplazamiento horizontal (las sombras no desbordan) y la pestaña activa se distingue por
   borde o subrayado además del color.

---

### User Story 3 - Resto de pantallas y modo oscuro (Priority: P3)

La pantalla de inicio (crear tablero), la de enlace no válido, el aviso del enlace recién
creado, el menú "Tablero" (renombrar, copiar enlace, borrar), los filtros, la gestión de
personas y el detalle de tarea usan el mismo estilo. Con el sistema en modo oscuro, toda la
interfaz usa la versión oscura neobrutalista con los mismos criterios de contraste.

**Why this priority**: completa la coherencia visual; las pantallas son secundarias frente al
tablero y el modo oscuro reutiliza los mismos componentes con otros colores.

**Independent Test**: recorrer inicio, enlace no válido, creación de tablero, menú "Tablero",
filtros, personas y detalle de tarea en claro y en oscuro, comprobando estilo y 0 violaciones
de accesibilidad en ambos modos.

**Acceptance Scenarios**:

1. **Given** la pantalla de inicio o la de enlace no válido, **When** se abre, **Then** usa el
   estilo neobrutalista con la acción principal destacada con el color primario.
2. **Given** el sistema en modo oscuro, **When** se abre cualquier pantalla, **Then** se ve la
   versión oscura (fondo casi negro, bordes y sombras claras) y todos los textos y controles
   cumplen el contraste exigido.
3. **Given** acciones peligrosas (borrar tarea, persona o tablero), **When** se muestran,
   **Then** usan el color de peligro junto a su texto.

---

### Edge Cases

- Textos largos (títulos de 200 caracteres, nombres de tablero largos): los bordes gruesos y
  las sombras no deben provocar desbordamiento horizontal ni tapar texto a 320 px.
- Zoom del navegador al 200 % o texto ampliado: el estilo no debe cortar contenido.
- Modo de alto contraste forzado del sistema (p. ej., colores forzados en Windows): bordes y
  foco siguen siendo visibles (los bordes no dependen de sombras para delimitar controles).
- Tipografía propia no disponible o lenta: se muestra la del sistema sin texto invisible.
- Movimiento reducido: ningún desplazamiento animado al pulsar, arrastrar o mostrar avisos.
- Cambio de preferencia claro/oscuro con la página abierta: la interfaz se adapta sin recargar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La interfaz web DEBE aplicar un estilo neobrutalista coherente en todas sus
  pantallas: fondos de color plano, bordes gruesos de alto contraste en controles, tarjetas,
  columnas y diálogos, sombras duras desplazadas sin desenfoque, esquinas casi rectas y
  tipografía gruesa.
- **FR-002**: Los colores, grosores, sombras, radios y tipografía DEBEN definirse en un único
  conjunto de valores compartido por todas las pantallas, de modo que un cambio de paleta no
  exija tocar cada pantalla.
- **FR-003**: DEBE existir una versión oscura del estilo que se aplique según la preferencia del
  sistema y se adapte si esta cambia con la página abierta.
- **FR-004**: Todo texto DEBE tener contraste ≥ 4.5:1 (≥ 3:1 si es grande) y todo borde de
  control, indicador de foco y elemento gráfico necesario DEBE tener contraste ≥ 3:1, en claro
  y en oscuro (WCAG 2.1 AA, FR-031 de la 001).
- **FR-005**: Cada columna de estado DEBE tener un color de acento propio (Pendiente amarillo,
  En progreso cian/azul, Hecha verde), siempre acompañado del nombre del estado; ninguna
  información DEBE transmitirse solo con color.
- **FR-006**: La acción principal de cada pantalla DEBE destacarse con el color primario y las
  acciones peligrosas y los errores con el color de peligro, siempre con su texto.
- **FR-007**: Botones y elementos interactivos con sombra DEBEN hundirse sobre su sombra al
  pasar el puntero o pulsarlos; con la preferencia de movimiento reducido NO DEBE haber
  desplazamiento animado.
- **FR-008**: El indicador de foco DEBE ser visible en todos los controles, distinguible de sus
  bordes y no quedar oculto por sombras ni por elementos vecinos.
- **FR-009**: Los estados deshabilitado, "Guardando…", arrastrando, columna destino, pestaña
  activa y error DEBEN distinguirse por algo más que el color (borde, sombra, texto o icono).
- **FR-010**: La tipografía propia DEBE servirse desde el propio TaskFlow, sin recursos de
  terceros ni cambios en la política de seguridad de contenido, y si no carga DEBE mostrarse el
  texto con la tipografía del sistema sin periodo de texto invisible.
- **FR-011**: Se DEBEN mantener los objetivos táctiles ≥ 44 × 44 px y la ausencia de
  desplazamiento horizontal desde 320 px de ancho (FR-033 de la 001), incluidas sombras y
  bordes.
- **FR-012**: El cambio NO DEBE alterar textos, nombres accesibles, orden de foco, flujos ni
  comportamiento existentes; las pruebas funcionales y de accesibilidad existentes DEBEN
  seguir pasando sin cambiar sus expectativas funcionales.
- **FR-013**: En modo de colores forzados del sistema, los controles DEBEN seguir delimitados y
  el foco visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La revisión automática de accesibilidad reporta 0 violaciones en tablero,
  diálogos, avisos, inicio, enlace no válido y menú "Tablero", tanto en modo claro como oscuro,
  a ancho de escritorio y a 320 px.
- **SC-002**: El 100 % de las combinaciones de color texto/fondo y borde/fondo del conjunto de
  valores compartido cumplen los umbrales de FR-004 en ambos modos (tabla de contrastes medida
  en la planificación).
- **SC-003**: El 100 % de los elementos interactivos visibles miden al menos 44 × 44 px y no hay
  desplazamiento horizontal a 320 px en ninguna pantalla.
- **SC-004**: Todas las pruebas automáticas existentes de las features 001 y 002 pasan sin
  cambiar sus expectativas funcionales.
- **SC-005**: Con movimiento reducido, ningún elemento se desplaza de forma animada al pulsar.
- **SC-006**: El tiempo hasta que el tablero es usable no empeora de forma perceptible: la
  tipografía añade como máximo 100 KB transferidos y el texto es visible desde el primer
  pintado.
- **SC-007**: En una validación manual, una persona identifica el estado de cada columna y la
  tarjeta "Guardando…" en escala de grises (sin color) en el 100 % de los casos.

## Assumptions

- El estilo es único: no se ofrece selector de tema ni personalización por tablero; claro u
  oscuro se decide solo por la preferencia del sistema, como hoy.
- No se añaden ilustraciones ni iconos nuevos más allá de los existentes; el estilo se logra con
  color, bordes, sombras y tipografía.
- La tipografía elegida tiene licencia libre que permite autoalojarla.
- No cambian textos de la interfaz, por lo que no hay cambios en las traducciones.
- La validación con lector de pantalla no es necesaria más allá de comprobar que no cambian
  nombres accesibles ni orden (cubierto por las pruebas existentes).
