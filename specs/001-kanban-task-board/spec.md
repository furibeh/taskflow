# Feature Specification: Tablero Kanban de Tareas (TaskFlow v1)

**Feature Branch**: `001-kanban-task-board`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Construye la primera versión de TaskFlow, una aplicación web para la
gestión de tareas de equipos pequeños. Los usuarios deben poder: ver las tareas en un tablero
Kanban; crear una tarea con título y descripción; asignar una tarea a una persona; cambiar su
estado entre Pendiente, En progreso y Hecha; filtrar las tareas por responsable y estado. En esta
versión no necesitamos autenticación ni colaboración en tiempo real. La interfaz debe ser
sencilla, accesible y adaptable a móviles. Define requisitos funcionales, criterios de
aceptación, comportamientos esperados y casos límite. No elijas todavía la arquitectura ni el
stack tecnológico. Identifica también las decisiones pendientes."

## Clarifications

### Session 2026-10-17

- Q: ¿Se incluyen en v1 la edición y el borrado de tareas? → A: Sí, ambos; el borrado
  requiere confirmación.
- Q: ¿Cómo se definen las personas asignables sin autenticación? → A: Lista gestionada dentro
  de la app (añadir y quitar nombres).
- Q: ¿Datos compartidos por el equipo o locales al dispositivo? → A: Compartidos: todo el
  equipo ve y edita el mismo tablero; los cambios ajenos aparecen al recargar.
- Q: ¿Puede una tarea sin responsable pasar a En progreso o a Hecha? → A: Sí, se permite
  cualquier estado sin responsable; la tarjeta muestra "Sin asignar" con texto e icono, no
  solo con color.
- Q: ¿Incluye la v1 una búsqueda por texto además de los filtros? → A: Sí, sobre título y
  descripción, sin distinguir mayúsculas ni tildes, combinada con los filtros; sin resultados
  muestra "No hay tareas que coincidan con «texto»" y "Limpiar búsqueda y filtros".
- Q: ¿La interfaz muestra los cambios al instante o espera la confirmación del guardado? → A:
  Espera la confirmación: indicador "Guardando…" con el control bloqueado; si falla, nada
  cambia, se muestra el error con "Reintentar" y no se pierde lo escrito.
- Q: ¿Cómo se limita el acceso al tablero compartido sin inicio de sesión? → A: Enlace secreto
  con un código largo imposible de adivinar, que el equipo comparte y que puede regenerarse
  para invalidar el anterior.
- Q: ¿Debe poder recuperarse una tarea borrada? → A: Sí, mediante "Deshacer" disponible
  durante 10 segundos tras confirmar el borrado; después el borrado es definitivo.
- Q: ¿Se incluye arrastrar y soltar para cambiar de estado? → A: Sí (petición del usuario
  durante la planificación), como complemento del control explícito, con ratón, táctil y
  teclado, cuando las tres columnas están visibles.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el tablero y crear tareas (Priority: P1)

Un miembro del equipo abre TaskFlow y ve un tablero con tres columnas: **Pendiente**,
**En progreso** y **Hecha**. Cada tarea aparece como una tarjeta en la columna de su estado.
Puede crear una tarea nueva indicando título y, opcionalmente, una descripción; la tarea aparece
en la columna Pendiente.

**Why this priority**: sin poder ver y crear tareas no existe producto. Es el núcleo mínimo
que ya aporta valor como lista compartida de trabajo.

**Independent Test**: abrir el tablero vacío, crear dos tareas y comprobar que ambas aparecen
en Pendiente con su título y que siguen ahí al recargar la página.

**Acceptance Scenarios**:

1. **Given** un tablero sin tareas, **When** el usuario lo abre, **Then** ve las tres columnas
   (Pendiente, En progreso, Hecha) con un mensaje que indica que no hay tareas y cómo crear una.
2. **Given** el formulario de nueva tarea, **When** el usuario introduce el título
   "Preparar demo" y la descripción "Slides y datos de ejemplo" y confirma, **Then** aparece una
   tarjeta "Preparar demo" en la columna Pendiente y el formulario se vacía.
3. **Given** el formulario de nueva tarea, **When** el usuario intenta confirmar con el título
   vacío o solo con espacios, **Then** la tarea no se crea y se muestra un mensaje junto al
   campo indicando que el título es obligatorio.
4. **Given** tareas creadas previamente, **When** el usuario recarga o vuelve a abrir la
   aplicación, **Then** ve las mismas tareas en las mismas columnas.
5. **Given** una tarjeta en el tablero, **When** el usuario la abre, **Then** ve su título,
   descripción completa, estado, responsable y fecha de creación.

---

### User Story 2 - Cambiar el estado de una tarea (Priority: P2)

Un miembro del equipo mueve una tarea entre Pendiente, En progreso y Hecha para reflejar su
avance. Puede hacerlo arrastrando la tarjeta (en pantallas que lo permitan) o mediante un
control explícito de estado usable con teclado y en pantallas táctiles.

**Why this priority**: el valor del Kanban está en visualizar el avance; sin cambio de estado
el tablero es solo una lista.

**Independent Test**: crear una tarea, cambiarla a En progreso y luego a Hecha usando solo el
teclado, y comprobar que la tarjeta cambia de columna y el cambio persiste tras recargar.

**Acceptance Scenarios**:

1. **Given** una tarea en Pendiente, **When** el usuario cambia su estado a En progreso,
   **Then** la tarjeta pasa a la columna En progreso.
2. **Given** una tarea en Hecha, **When** el usuario cambia su estado a Pendiente, **Then** la
   tarjeta vuelve a Pendiente (se permiten transiciones entre cualquier par de estados).
2a. **Given** el tablero con las tres columnas visibles, **When** el usuario arrastra una tarjeta
   de Pendiente y la suelta en Hecha (con ratón o pantalla táctil), **Then** la columna destino
   se resalta durante el arrastre, la tarjeta muestra "Guardando…" en su columna de origen y,
   al confirmarse el guardado, aparece en Hecha.
2b. **Given** un usuario de teclado, **When** enfoca una tarjeta, pulsa Espacio para cogerla,
   usa las flechas para elegir columna y pulsa Espacio para soltarla, **Then** el estado cambia
   y cada paso se anuncia ("Tarea cogida", "Sobre En progreso", "Tarea soltada en
   En progreso"); Escape cancela sin cambios.
2c. **Given** un arrastre en curso, **When** el usuario suelta la tarjeta en su misma columna o
   fuera de cualquier columna, **Then** no se realiza ninguna petición y la tarjeta vuelve a
   su sitio.
3. **Given** un usuario que solo usa teclado o lector de pantalla, **When** cambia el estado de
   una tarea mediante el control de estado, **Then** el cambio se aplica y se anuncia el nuevo
   estado de forma accesible.
4. **Given** un cambio de estado que no puede guardarse, **When** falla la operación, **Then** la
   tarjeta permanece en su columna original (nunca llega a moverse), se muestra un error
   comprensible con la acción "Reintentar" y el error se anuncia a tecnologías de asistencia.
5. **Given** un cambio de estado en curso, **When** el sistema aún no ha confirmado el guardado,
   **Then** la tarjeta muestra "Guardando…" y su control de estado no admite otro cambio hasta
   terminar.

---

### User Story 3 - Asignar una tarea a una persona (Priority: P3)

Un miembro del equipo asigna una tarea a una persona del equipo para que quede claro quién se
encarga. La asignación puede hacerse al crear la tarea o después, y puede cambiarse o quitarse.

**Why this priority**: aporta claridad de responsabilidades, pero el tablero ya es útil sin ella.

**Independent Test**: crear una tarea, asignarla a una persona, comprobar que la tarjeta
muestra el responsable, reasignarla a otra persona y luego dejarla sin asignar.

**Acceptance Scenarios**:

1. **Given** una tarea sin asignar, **When** el usuario elige a "Ana" como responsable,
   **Then** la tarjeta muestra a Ana como responsable.
2. **Given** una tarea asignada a Ana, **When** el usuario la reasigna a "Luis", **Then** la
   tarjeta muestra a Luis y deja de mostrar a Ana.
3. **Given** una tarea asignada, **When** el usuario quita la asignación, **Then** la tarjeta
   aparece como "Sin asignar" (texto e icono) y conserva su estado actual.
4. **Given** una tarea sin responsable en Pendiente, **When** el usuario la mueve a En progreso
   o a Hecha, **Then** el cambio se aplica sin exigir asignación.
5. **Given** el formulario de nueva tarea, **When** el usuario elige un responsable antes de
   confirmar, **Then** la tarea se crea ya asignada.

---

### User Story 4 - Buscar y filtrar tareas (Priority: P4)

Un miembro del equipo filtra el tablero para ver solo las tareas de una persona, solo las
tareas sin asignar o solo las de ciertos estados, y busca tareas por texto en su título o
descripción. Búsqueda y filtros pueden combinarse.

**Why this priority**: mejora la productividad cuando hay muchas tareas, pero depende de que
existan estados y responsables.

**Independent Test**: con tareas de varios responsables y estados, aplicar el filtro "Ana" +
"En progreso" y comprobar que solo se ven las tareas de Ana en progreso; limpiar filtros y
comprobar que se ven todas.

**Acceptance Scenarios**:

1. **Given** tareas de Ana y Luis, **When** el usuario filtra por responsable "Ana", **Then**
   solo ve las tareas asignadas a Ana, en sus columnas correspondientes.
2. **Given** tareas sin asignar, **When** el usuario filtra por "Sin asignar", **Then** solo ve
   las tareas sin responsable.
3. **Given** el filtro de estado, **When** el usuario selecciona solo "Pendiente" y
   "En progreso", **Then** las tareas Hechas dejan de mostrarse.
4. **Given** filtros de responsable y estado activos, **When** se aplican juntos, **Then** solo
   se muestran las tareas que cumplen ambos (combinación AND).
5. **Given** filtros que no coinciden con ninguna tarea, **When** se aplican, **Then** se
   muestra un mensaje "No hay tareas que coincidan con los filtros" y una acción para limpiarlos.
6. **Given** filtros activos, **When** el usuario pulsa "Limpiar búsqueda y filtros", **Then** se muestran
   de nuevo todas las tareas.
7. **Given** una tarea titulada "Revisión de Diseño", **When** el usuario busca "revision",
   **Then** la tarea aparece (sin distinguir mayúsculas ni tildes).
8. **Given** una búsqueda "factura" y el filtro de responsable "Ana", **When** se aplican juntos,
   **Then** solo se muestran las tareas de Ana que contienen "factura" en título o descripción.
9. **Given** una búsqueda "zzz" sin coincidencias, **When** se aplica, **Then** las columnas no
   muestran tarjetas, se muestra "No hay tareas que coincidan con «zzz»" y un botón
   "Limpiar búsqueda y filtros" que, al pulsarlo, vuelve a mostrar todas las tareas.
10. **Given** filtros o búsqueda activos, **When** el usuario crea una tarea que no cumple los filtros,
   **Then** la tarea se crea correctamente y se le informa de que no es visible por los filtros
   activos.
11. **Given** un filtro activo por Luis, **When** Luis es quitado de la lista de personas,
   **Then** el filtro de responsable vuelve a "Todos".

---

### User Story 5 - Editar y borrar tareas (Priority: P5)

Un miembro del equipo corrige el título o la descripción de una tarea, o la borra cuando ya no
tiene sentido. El borrado pide confirmación para evitar pérdidas accidentales.

**Why this priority**: permite corregir errores y mantener el tablero limpio, pero el flujo
principal funciona sin ello.

**Independent Test**: crear una tarea, editar su título y descripción, comprobar el cambio
tras recargar; después borrarla confirmando y comprobar que desaparece.

**Acceptance Scenarios**:

1. **Given** una tarea existente, **When** el usuario edita su título y descripción y guarda,
   **Then** la tarjeta y el detalle muestran los nuevos valores, y el estado y el responsable
   no cambian.
2. **Given** la edición de una tarea, **When** el usuario deja el título vacío o supera los
   límites, **Then** el cambio se rechaza con el mismo mensaje que al crear y la tarea conserva
   sus valores anteriores.
3. **Given** la edición de una tarea, **When** el usuario cancela, **Then** no se guarda ningún
   cambio.
4. **Given** una tarea, **When** el usuario pide borrarla, **Then** se le pide confirmación
   indicando el título de la tarea; solo si confirma, la tarea desaparece del tablero y se
   muestra el aviso "Tarea borrada" con la acción "Deshacer".
5. **Given** la confirmación de borrado, **When** el usuario cancela, **Then** la tarea
   permanece intacta.
6. **Given** una tarea recién borrada, **When** el usuario pulsa "Deshacer" antes de que pasen
   10 segundos, **Then** la tarea reaparece con el mismo título, descripción, estado,
   responsable y fecha de creación.
7. **Given** una tarea borrada, **When** pasan 10 segundos sin pulsar "Deshacer", **Then** el
   aviso desaparece y el borrado es definitivo.

---

### User Story 6 - Gestionar las personas del equipo (Priority: P3)

Un miembro del equipo mantiene la lista de personas a las que se pueden asignar tareas:
añade nombres nuevos y quita a quien ya no forma parte del equipo.

**Why this priority**: es requisito previo de la asignación (User Story 3), por lo que comparte
su prioridad.

**Independent Test**: añadir "Ana" y "Luis", comprobar que aparecen como opciones de
asignación y de filtro; quitar a Luis y comprobar que deja de aparecer y que sus tareas quedan
sin asignar.

**Acceptance Scenarios**:

1. **Given** la lista de personas, **When** el usuario añade "Ana", **Then** Ana aparece en la
   lista y como opción al asignar y al filtrar.
2. **Given** que "Ana" ya existe, **When** el usuario intenta añadir "ana" o " Ana ", **Then**
   se rechaza indicando que esa persona ya existe.
3. **Given** un nombre vacío o de más de 50 caracteres, **When** el usuario intenta añadirlo,
   **Then** se rechaza con un mensaje claro.
4. **Given** que Luis tiene 3 tareas asignadas, **When** el usuario pide quitarlo, **Then** se
   le pide confirmación indicando que 3 tareas quedarán sin asignar; al confirmar, Luis
   desaparece de la lista y esas tareas aparecen como "Sin asignar".

---

### Edge Cases

- **Título vacío o solo espacios**: se rechaza; los espacios al inicio y final se eliminan
  antes de validar y guardar.
- **Título o descripción demasiado largos**: el título admite hasta 200 caracteres y la
  descripción hasta 5.000; se impide superar el límite y se muestra el contador/mensaje
  correspondiente.
- **Contenido con HTML, scripts o caracteres especiales** (emojis, tildes, `<script>`): se
  guarda y muestra como texto literal, nunca se interpreta ni ejecuta.
- **Doble envío** (pulsar "Crear" dos veces rápidamente): solo se crea una tarea.
- **Estado inválido** (valor distinto de Pendiente, En progreso, Hecha recibido por el sistema):
  se rechaza sin modificar la tarea.
- **Responsable inexistente** o eliminado: la asignación se rechaza; las tareas no pueden quedar
  apuntando a una persona que no existe.
- **Tarea modificada o eliminada por otra persona** mientras el usuario la ve (no hay tiempo
  real): al operar sobre ella, el sistema informa de que la tarea ya no existe o ha cambiado y
  muestra el estado actual tras refrescar; prevalece el último cambio guardado.
- **Pérdida de conexión o error al guardar** (crear, editar, mover, asignar, borrar o
  gestionar personas): el tablero no refleja el cambio, no se pierde lo escrito en el
  formulario, se muestra un error comprensible con "Reintentar" y no hay reintentos
  automáticos.
- **Guardado lento**: mientras no hay confirmación, se muestra "Guardando…" y la acción queda
  bloqueada para evitar envíos duplicados; si no hay respuesta en 10 segundos, se trata como un
  error de guardado.
- **Reintento tras fallo**: reintentar una creación nunca produce tareas duplicadas.
- **Muchas tareas en una columna** (p. ej., 200): el tablero sigue siendo usable; cada columna
  permite desplazarse y muestra el número de tareas que contiene.
- **Pantalla estrecha** (320 px de ancho): todo el contenido y las acciones son accesibles sin
  desplazamiento horizontal de la página; las columnas pueden mostrarse apiladas o como pestañas.
- **Dispositivo táctil sin arrastrar y soltar fiable**: el cambio de estado siempre está
  disponible con un control explícito, no solo arrastrando.
- **Arrastre frente a desplazamiento en táctil**: el arrastre solo empieza tras mantener
  pulsada la tarjeta ~250 ms, para no interferir con el desplazamiento de la página.
- **Arrastrar una tarjeta que está guardando**: no se permite; la tarjeta no es arrastrable
  hasta que termina su guardado anterior.
- **Controles dentro de la tarjeta**: usar el selector de estado (u otro control interactivo
  de la tarjeta) nunca inicia un arrastre; tras cambiar el estado con el selector, mover el
  puntero no arrastra la tarjeta.
- **Pantallas estrechas con columnas en pestañas**: el arrastrar y soltar no se ofrece porque
  solo hay una columna visible; se usa el control de estado.
- **Nombres de persona duplicados**: no se permiten dos personas con el mismo nombre visible
  (sin distinguir mayúsculas/minúsculas ni espacios en los extremos).
- **Quitar una persona con tareas asignadas**: tras confirmación, sus tareas pasan a
  "Sin asignar"; ninguna tarea queda apuntando a una persona inexistente.
- **Lista de personas vacía**: el selector de responsable solo ofrece "Sin asignar" e indica
  cómo añadir personas.
- **Editar o borrar una tarea ya borrada por otra persona**: se informa de que la tarea ya no
  existe y se actualiza el tablero.
- **Enlace secreto incorrecto, incompleto o ya regenerado**: se muestra una página genérica
  "Enlace no válido" que no revela si el tablero existe ni ningún dato suyo.
- **Regeneración del enlace mientras otra persona usa el anterior**: su siguiente operación
  falla con el mensaje de enlace no válido; no se guarda ningún cambio con el enlace antiguo.
- **Enlace filtrado**: cualquier persona con el enlace vigente tiene acceso completo hasta que
  se regenere; este riesgo se acepta explícitamente en v1.

## Requirements *(mandatory)*

### Functional Requirements

**Tablero**

- **FR-001**: El sistema DEBE mostrar un único tablero con tres columnas fijas en este orden:
  Pendiente, En progreso y Hecha.
- **FR-002**: Cada tarjeta DEBE mostrar como mínimo el título y el responsable (o "Sin asignar").
- **FR-003**: Cada columna DEBE mostrar el número de tareas visibles que contiene.
- **FR-004**: Dentro de cada columna, las tareas DEBEN ordenarse por fecha de creación, de la más
  reciente a la más antigua.
- **FR-005**: El usuario DEBE poder abrir una tarea para ver su detalle completo: título,
  descripción, estado, responsable y fecha de creación.
- **FR-006**: El tablero vacío y cada columna vacía DEBEN mostrar un mensaje orientativo.

**Creación de tareas**

- **FR-007**: Los usuarios DEBEN poder crear una tarea con título (obligatorio) y descripción
  (opcional), y opcionalmente un responsable.
- **FR-008**: Toda tarea nueva DEBE crearse en estado Pendiente.
- **FR-009**: El sistema DEBE validar, independientemente de las comprobaciones de la interfaz,
  el título (1–200 caracteres tras eliminar
  espacios en los extremos) y la descripción (0–5.000 caracteres), rechazando entradas
  inválidas con un mensaje claro y sin crear la tarea.
- **FR-010**: El sistema DEBE tratar todo texto introducido por el usuario como texto literal al
  mostrarlo.
- **FR-011**: El sistema DEBE evitar que un doble envío del formulario o un reintento tras un
  error creen tareas duplicadas.
- **FR-012**: Las tareas DEBEN persistir entre sesiones y recargas de página.
- **FR-013**: Los usuarios DEBEN poder editar el título y la descripción de una tarea
  existente, con las mismas reglas de validación que al crearla (FR-009); la edición no
  modifica el estado ni el responsable.
- **FR-013a**: Los usuarios DEBEN poder borrar una tarea, previa confirmación explícita que
  muestre el título de la tarea.
- **FR-013b**: Las operaciones sobre una tarea que ya no existe DEBEN fallar con un mensaje
  claro y actualizar el tablero.
- **FR-013c**: Tras borrar una tarea, el sistema DEBE ofrecer durante 10 segundos la acción
  "Deshacer", que restaura la tarea con todos sus datos (título, descripción, estado,
  responsable y fecha de creación). El aviso DEBE ser operable con teclado y anunciarse a
  tecnologías de asistencia. Si tiene el foco al cumplirse los 10 segundos, el aviso permanece
  visible hasta que lo pierda, pero la acción "Deshacer" se desactiva y se anuncia "Ya no se
  puede deshacer". Pasados los 10 segundos, el borrado DEBE ser definitivo para el usuario.
- **FR-013d**: Si el responsable de la tarea fue quitado de la lista de personas durante el
  plazo de deshacer, la tarea DEBE restaurarse como "Sin asignar".

**Asignación**

- **FR-014**: Los usuarios DEBEN poder asignar una tarea a una persona, reasignarla o dejarla
  sin asignar, tanto al crearla como después.
- **FR-015**: Una tarea DEBE tener como máximo un responsable. El responsable es opcional en
  todos los estados: una tarea sin responsable PUEDE estar en Pendiente, En progreso o Hecha.
- **FR-015a**: Las tarjetas sin responsable DEBEN indicarlo con el texto "Sin asignar"
  acompañado de un icono, sin depender solo del color.
- **FR-016**: El sistema DEBE mantener una lista de personas del equipo gestionada desde la
  propia aplicación; los usuarios DEBEN poder añadir y quitar personas.
- **FR-016a**: El nombre de una persona DEBE tener entre 1 y 50 caracteres tras eliminar
  espacios en los extremos y ser único sin distinguir mayúsculas/minúsculas.
- **FR-016b**: Quitar una persona DEBE requerir confirmación que indique cuántas tareas tiene
  asignadas; al confirmarse, esas tareas DEBEN quedar sin asignar.
- **FR-017**: El sistema DEBE rechazar la asignación a una persona que no exista en la lista de
  personas del equipo.

**Cambio de estado**

- **FR-018**: Los usuarios DEBEN poder cambiar el estado de una tarea a cualquiera de los otros
  dos estados.
- **FR-019**: El cambio de estado DEBE poder realizarse mediante un control explícito operable
  con teclado, ratón y pantalla táctil, en todos los tamaños de pantalla.
- **FR-019a**: Cuando las tres columnas estén visibles a la vez, los usuarios DEBEN poder
  además cambiar el estado arrastrando una tarjeta a otra columna con ratón, pantalla táctil
  o teclado. El arrastre DEBE resaltar la columna destino, anunciar cada paso a tecnologías
  de asistencia, poder cancelarse con Escape y seguir las mismas reglas de guardado que el
  control explícito (FR-021, FR-021a). Soltar en la misma columna no produce ningún cambio.
- **FR-020**: El sistema DEBE rechazar cualquier estado distinto de Pendiente, En progreso y
  Hecha.
- **FR-021**: Toda operación que modifica datos (crear, editar, cambiar estado, asignar,
  borrar, gestionar personas) DEBE reflejarse en el tablero solo después de confirmarse su
  guardado. Mientras tanto, DEBE mostrarse el indicador "Guardando…" y la acción DEBE quedar
  bloqueada.
- **FR-021a**: Si el guardado falla o no se confirma en 10 segundos, el sistema DEBE dejar la
  tarea y el tablero sin cambios, conservar lo escrito en el formulario, mostrar un mensaje de
  error comprensible con la acción "Reintentar" y anunciarlo a tecnologías de asistencia. No
  DEBE reintentar automáticamente.

**Búsqueda y filtros**

- **FR-022**: Los usuarios DEBEN poder filtrar por responsable: una persona concreta,
  "Sin asignar" o "Todos".
- **FR-023**: Los usuarios DEBEN poder filtrar por uno o varios estados.
- **FR-024**: Los filtros de responsable, estado y la búsqueda por texto DEBEN combinarse con
  lógica AND.
- **FR-024a**: Los usuarios DEBEN poder buscar tareas por texto; una tarea coincide si el texto
  buscado (tras eliminar espacios en los extremos) aparece en su título o descripción, sin
  distinguir mayúsculas/minúsculas ni tildes. Una búsqueda vacía no filtra.
- **FR-024b**: La búsqueda DEBE admitir hasta 100 caracteres y tratar el texto de forma literal
  (sin comodines ni sintaxis especial).
- **FR-025**: Los filtros y la búsqueda activos DEBEN ser visibles en todo momento y poder
  limpiarse juntos con una sola acción.
- **FR-026**: Cuando ninguna tarea coincida, el sistema DEBE indicarlo: si hay búsqueda activa,
  con el mensaje "No hay tareas que coincidan con «texto»"; si solo hay filtros, con
  "No hay tareas que coincidan con los filtros". En ambos casos DEBE ofrecer la acción
  "Limpiar búsqueda y filtros" y el mensaje DEBE anunciarse a tecnologías de asistencia.
- **FR-027**: Los filtros y la búsqueda DEBEN conservarse al recargar la página en el mismo
  dispositivo.

**Alcance, acceso y datos compartidos**

- **FR-028**: La versión 1 NO DEBE requerir registro ni inicio de sesión.
- **FR-028a**: El acceso al tablero DEBE requerir un enlace secreto que contenga un código de
  acceso aleatorio de al menos 128 bits de entropía; sin un código válido no DEBE mostrarse ni
  modificarse ningún dato.
- **FR-028b**: Cualquier persona con el enlace vigente DEBE poder regenerarlo, previa
  confirmación; al hacerlo, el enlace anterior DEBE dejar de funcionar inmediatamente para
  todas las operaciones, y el nuevo enlace DEBE mostrarse con una acción para copiarlo.
- **FR-028c**: Un código de acceso inválido DEBE producir una respuesta genérica
  "Enlace no válido" que no permita distinguir entre tableros inexistentes y códigos
  incorrectos.
- **FR-028d**: El código de acceso NO DEBE aparecer en mensajes de error ni enviarse a
  servicios de terceros.
- **FR-029**: Los datos del tablero (tareas y personas) DEBEN ser compartidos: todos los
  miembros del equipo ven y modifican el mismo tablero desde cualquier dispositivo.
- **FR-030**: El sistema NO necesita reflejar en tiempo real los cambios de otras personas; los
  cambios ajenos DEBEN aparecer al recargar la página.

**Interfaz, accesibilidad y adaptación a móviles**

- **FR-031**: La interfaz DEBE cumplir las pautas de accesibilidad WCAG 2.1 nivel AA: navegación
  completa por teclado, foco visible, etiquetas en todos los controles, contraste suficiente,
  anuncio de cambios (creación, cambio de estado, errores) a tecnologías de asistencia y no
  transmitir información solo mediante color.
- **FR-032**: La interfaz DEBE ser usable desde 320 px de ancho hasta escritorio sin
  desplazamiento horizontal de la página.
- **FR-033**: Los elementos interactivos DEBEN tener un área táctil mínima de 44×44 px.
- **FR-034**: Los mensajes de error DEBEN ser comprensibles para el usuario, indicar cómo
  resolver el problema y no revelar detalles internos del sistema.

### Key Entities *(include if feature involves data)*

- **Tarea**: unidad de trabajo del equipo. Atributos: identificador, título, descripción
  (opcional), estado (Pendiente | En progreso | Hecha), responsable (opcional, referencia a una
  Persona), fecha de creación y fecha de última modificación.
- **Persona**: miembro del equipo al que se puede asignar una tarea, gestionado desde la app.
  Atributos: identificador y nombre visible (1–50 caracteres, único sin distinguir
  mayúsculas). Una persona puede ser responsable de muchas tareas; al quitarla, sus tareas
  quedan sin asignar. No es una cuenta de usuario: no tiene credenciales.
- **Tablero**: espacio compartido único del equipo que contiene tareas y personas. Atributos:
  código de acceso vigente (secreto, regenerable) y fecha de la última regeneración.
- **Estado**: conjunto cerrado de tres valores ordenados (Pendiente, En progreso, Hecha) que
  determina la columna de la tarea.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo crea su primera tarea en menos de 30 segundos desde que abre la
  aplicación, sin instrucciones.
- **SC-002**: Un usuario cambia el estado de una tarea en 2 interacciones o menos.
- **SC-003**: Con 200 tareas en el tablero, abrir el tablero, buscar, aplicar un filtro o cambiar un
  estado muestra el resultado en menos de 1 segundo para el usuario en una conexión móvil
  típica.
- **SC-004**: El 100% de las acciones (crear, editar, borrar, asignar, cambiar estado,
  buscar, filtrar, gestionar personas) puede
  completarse solo con teclado y con un lector de pantalla.
- **SC-005**: El 100% de las acciones puede completarse en un dispositivo de 320 px de ancho sin
  desplazamiento horizontal.
- **SC-006**: Una auditoría de accesibilidad automática y manual no detecta incumplimientos de
  WCAG 2.1 AA.
- **SC-007**: El 90% de los usuarios de prueba completan sin ayuda las tareas: añadir una
  persona, crear una tarea, asignarla, moverla a Hecha y filtrar por responsable, en su primer
  intento.
- **SC-008**: 0 tareas perdidas o duplicadas en las pruebas de recarga, doble envío y errores de
  guardado.
- **SC-009**: Un cambio hecho por un miembro del equipo es visible para otro miembro en otro
  dispositivo al recargar la página.

## Assumptions

- Los equipos son pequeños: hasta unas 15 personas y unos cientos de tareas activas por tablero.
- Hay un único tablero en v1; no existen múltiples tableros, proyectos ni equipos.
- Los tres estados son fijos; no se pueden añadir, renombrar ni reordenar columnas.
- Se permiten transiciones entre cualquier par de estados.
- No hay límites WIP, fechas de vencimiento, prioridades, etiquetas, comentarios, adjuntos,
  historial de cambios ni notificaciones en v1.
- No hay reordenación manual de tarjetas dentro de una columna en v1.
- La interfaz ofrece "Deshacer" durante 10 segundos solo en el dispositivo que borró. El
  servidor acepta la restauración hasta 15 segundos después, como margen para la latencia de
  red; pasado ese tiempo, la tarea se elimina físicamente. No hay papelera en v1. Si el usuario
  recarga o cierra la página en ese plazo, el borrado pasa a ser definitivo.
- Quitar una persona no se puede deshacer (ya requiere confirmación con el número de tareas
  afectadas).
- Cualquier persona con el enlace vigente puede gestionar tareas, personas y regenerar el
  enlace; no hay roles.
- Ante ediciones concurrentes, prevalece el último cambio guardado.
- La interfaz se ofrece en español.
- Se usan navegadores modernos (últimas dos versiones de los principales navegadores de
  escritorio y móvil).
- Requiere conexión para guardar cambios; no hay modo offline.

## Decisiones Pendientes

Decisiones que no se toman en esta especificación. Las de producto se resuelven con
`/speckit-clarify`; las técnicas, en `/speckit-plan`. Según la constitución, las que afecten a
arquitectura o seguridad DEBEN explicarse antes de aplicarse.

**Producto (resueltas el 2026-10-17, ver Clarifications)**

1. ~~Edición y borrado de tareas~~ → incluidos, borrado con confirmación y "Deshacer" de
   10 segundos (FR-013, FR-013a, FR-013c).
2. ~~Personas asignables~~ → lista gestionada en la app (FR-016).
3. ~~Datos compartidos o locales~~ → compartidos por el equipo (FR-029).

**Seguridad (derivada de compartir datos sin autenticación)**

4. ~~Control de acceso al tablero compartido~~ → enlace secreto regenerable (FR-028a–d).
   Riesgo aceptado: quien tenga el enlace vigente puede ver, editar y borrar todo.
   Primer enlace: generado por consola (`board:init`), ver plan.md D4.
5. ~~Límites de uso~~ → límites por IP y CSP (plan.md D5). **Sigue pendiente**: política de
   copias de seguridad y restauración (frecuencia, retención, quién puede restaurar), a
   definir en la feature de despliegue. "Deshacer" solo cubre borrados accidentales.

**Arquitectura y tecnología** — resueltas en `plan.md` (D1–D10, aprobadas el 2026-10-17)

6. ~~Stack~~ → React + TypeScript, Node.js + TypeScript (Fastify), PostgreSQL.
7. ~~Persistencia y despliegue~~ → PostgreSQL 17 con Docker Compose en local; alojamiento
   **pendiente** (feature de despliegue).
8. ~~Pruebas~~ → Vitest, PostgreSQL de pruebas, Playwright + axe (research.md R15).
9. ~~Migraciones~~ → Kysely con `up`/`down` (research.md R6).

**Evolución futura (fuera de alcance en v1, pero condicionan el diseño)**

10. Cómo se incorporará autenticación y cómo se vincularán las Personas actuales a cuentas.
11. Si se añadirá colaboración en tiempo real y múltiples tableros/equipos.
