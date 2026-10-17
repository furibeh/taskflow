# Feature Specification: Múltiples tableros (uno por equipo)

**Feature Branch**: `002-multiple-boards`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Permitir varios tableros independientes, uno por equipo.
Cualquiera puede crear un tablero desde la pantalla de inicio indicando su nombre; al crearlo se
muestra una vez su enlace secreto. Cada enlace da acceso a un único tablero y los datos de un
tablero (tareas, personas) nunca son visibles desde otro. El tablero tiene un nombre visible
que los miembros pueden cambiar. Los miembros pueden borrar el tablero con confirmación; se
borran sus tareas y personas. Las instalaciones existentes conservan su tablero actual."

## Clarifications

### Session 2026-10-17

- Q: ¿El borrado de un tablero es definitivo de inmediato o se puede deshacer durante un
  plazo? → A: Definitivo de inmediato, tras confirmar escribiendo el nombre exacto del
  tablero; no hay "Deshacer" ni recuperación posterior.
- Q: ¿Qué pasa si se intenta cerrar el aviso del enlace recién creado sin copiarlo ni abrir el
  tablero? → A: Se pide confirmación ("No podrás volver a ver este enlace. ¿Cerrar de todos
  modos?"); si ya se copió el enlace o se abrió el tablero, se cierra sin preguntar.
- Q: ¿Qué puede hacer desde la consola del servidor quien administra la instalación? → A:
  Crear un tablero, listar los tableros (identificador, nombre, fecha de creación, nº de
  tareas y personas, última actividad), regenerar el enlace y borrar un tablero indicándolo
  por su identificador, con confirmación. Sin limpieza automática.
- Q: ¿Cuántos tableros se pueden crear por hora desde una misma red y es configurable? → A:
  10 por hora por defecto, configurable por quien administra la instalación.
- Q: (planificación) Si la respuesta de la creación se pierde (timeout o corte) pero el tablero
  sí se creó, ¿cómo se recupera su enlace? → A: No se recupera: el enlace lo genera siempre el
  servidor y no se puede volver a mostrar. El reintento no crea un segundo tablero e informa
  de que el tablero se creó sin poder mostrar su enlace; el usuario crea otro y el primero
  queda huérfano (quien administra puede borrarlo desde la consola).

**Relación con la feature 001**: esta especificación amplía `specs/001-kanban-task-board` y
sustituye explícitamente: FR-001 ("un único tablero"), la suposición "Hay un único tablero en
v1", la definición de la entidad **Tablero** y la decisión pendiente 4 (primer enlace solo por
consola). El resto de requisitos de la 001 (tareas, personas, filtros, enlace secreto,
accesibilidad, guardado pesimista) se aplican sin cambios **dentro de cada tablero**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un tablero para mi equipo (Priority: P1)

Una persona abre TaskFlow sin enlace (o con un enlace no válido) y ve una pantalla de inicio
con la opción **Crear tablero**. Indica el nombre del tablero (p. ej., "Equipo Diseño") y lo
crea. TaskFlow le muestra el enlace secreto del tablero nuevo, con una acción para copiarlo y
el aviso de que no se volverá a mostrar, y le permite abrir el tablero, que aparece vacío con
su nombre en la cabecera.

**Why this priority**: sin poder crear tableros no hay tableros para varios equipos; es el
mínimo que aporta valor (un equipo nuevo puede empezar sin intervención de quien administra
el servidor).

**Independent Test**: desde la pantalla de inicio, crear el tablero "Equipo Diseño", copiar el
enlace, abrirlo en otra ventana y comprobar que se ve un tablero vacío con ese nombre en el
que se pueden crear tareas.

**Acceptance Scenarios**:

1. **Given** la aplicación abierta sin enlace, **When** el usuario la abre, **Then** ve la
   pantalla de inicio con la acción "Crear tablero" y una explicación de que, para entrar a un
   tablero existente, necesita el enlace de su equipo.
2. **Given** el formulario de nuevo tablero, **When** el usuario escribe "Equipo Diseño" y
   confirma, **Then** se muestra el enlace del tablero nuevo con la acción "Copiar enlace", el
   aviso "Guarda este enlace: no se volverá a mostrar" y la acción "Abrir tablero".
3. **Given** el enlace recién mostrado, **When** el usuario pulsa "Abrir tablero", **Then** ve
   el tablero vacío con "Equipo Diseño" en la cabecera y los mensajes orientativos de tablero
   vacío de la 001 (FR-006).
4. **Given** el formulario de nuevo tablero, **When** el usuario intenta confirmar con el
   nombre vacío o solo con espacios, **Then** no se crea ningún tablero y se muestra junto al
   campo que el nombre es obligatorio.
5. **Given** un enlace no válido, **When** el usuario lo abre, **Then** ve el mensaje genérico
   "Enlace no válido" (FR-028c de la 001) y, además, la acción "Crear un tablero nuevo".

---

### User Story 2 - Tableros aislados entre equipos (Priority: P1)

Dos equipos usan la misma instalación de TaskFlow, cada uno con su enlace. Cada equipo solo
ve y modifica sus propias tareas y personas; nada de lo que hace un equipo es visible ni
afecta al otro.

**Why this priority**: es la condición de seguridad que hace aceptable alojar a varios
equipos en la misma instalación; sin aislamiento, la US1 sería perjudicial.

**Independent Test**: crear los tableros A y B; en A crear la tarea "Solo A" y la persona
"Ana"; abrir B y comprobar que no aparece ni la tarea ni la persona, y que el filtro de
responsable de B no ofrece "Ana".

**Acceptance Scenarios**:

1. **Given** los tableros A y B con tareas propias, **When** se abre el enlace de A, **Then**
   solo se ven las tareas y personas de A, en el tablero, en la búsqueda y en los filtros.
2. **Given** el enlace de B, **When** se intenta ver, editar, mover, borrar o restaurar una
   tarea de A (p. ej., conociendo su identificador), **Then** la operación falla como si la
   tarea no existiera y no se modifica nada.
3. **Given** el enlace de B, **When** se intenta asignar una tarea de B a una persona de A,
   **Then** la asignación se rechaza como responsable inexistente (FR-017 de la 001).
4. **Given** los tableros A y B, **When** alguien regenera el enlace de A, **Then** el enlace
   de B sigue funcionando sin cambios.
5. **Given** dos tableros, **When** ambos tienen una persona llamada "Ana", **Then** se
   permite: la unicidad de nombres de persona es por tablero.

---

### User Story 3 - Ver y cambiar el nombre del tablero (Priority: P2)

Un miembro del equipo ve el nombre del tablero en la cabecera (y en el título de la pestaña
del navegador) y puede cambiarlo, por ejemplo si el equipo cambia de nombre.

**Why this priority**: el nombre permite a quien pertenece a varios equipos distinguir en qué
tablero está, pero cada tablero ya es útil con el nombre puesto al crearlo.

**Independent Test**: en un tablero llamado "Equipo Diseño", cambiar el nombre a
"Diseño y UX", recargar y comprobar que la cabecera y el título de la pestaña muestran el
nombre nuevo, también desde otro dispositivo.

**Acceptance Scenarios**:

1. **Given** un tablero abierto, **When** el usuario lo ve, **Then** su nombre aparece en la
   cabecera y en el título de la pestaña del navegador.
2. **Given** la acción "Cambiar nombre", **When** el usuario escribe "Diseño y UX" y
   confirma, **Then** tras confirmarse el guardado la cabecera muestra el nombre nuevo.
3. **Given** la acción "Cambiar nombre", **When** el usuario confirma un nombre vacío o
   demasiado largo, **Then** el nombre no cambia y se muestra un mensaje junto al campo.
4. **Given** un error de guardado al cambiar el nombre, **When** ocurre, **Then** el nombre no
   cambia, se conserva lo escrito y se ofrece "Reintentar" (FR-021a de la 001).

---

### User Story 4 - Borrar un tablero (Priority: P3)

Un miembro del equipo borra un tablero que ya no se usa. Debe confirmarlo de forma
inequívoca, porque el borrado elimina todas sus tareas y personas.

**Why this priority**: mantiene limpia la instalación y permite a un equipo retirar sus
datos, pero no es necesario para el uso diario.

**Independent Test**: en un tablero con tareas y personas, borrar el tablero escribiendo su
nombre para confirmar; comprobar que se vuelve a la pantalla de inicio y que el enlace del
tablero muestra después "Enlace no válido".

**Acceptance Scenarios**:

1. **Given** un tablero con 12 tareas y 3 personas, **When** el usuario elige "Borrar
   tablero", **Then** ve una confirmación que indica el nombre del tablero, que se borrarán
   12 tareas y 3 personas y que la acción es definitiva y no se puede deshacer.
2. **Given** la confirmación, **When** el usuario no escribe exactamente el nombre del
   tablero, **Then** la acción de borrar permanece desactivada.
3. **Given** la confirmación completada, **When** el borrado se guarda, **Then** el usuario
   vuelve a la pantalla de inicio con el aviso "Tablero «nombre» borrado".
4. **Given** un tablero borrado, **When** cualquier persona abre su enlace o realiza una
   operación con él (incluso con la página ya abierta), **Then** obtiene "Enlace no válido"
   y no se muestra ni modifica ningún dato.
5. **Given** los tableros A y B, **When** se borra A, **Then** B y sus datos no cambian.

---

### Edge Cases

- **Instalación existente con un tablero**: tras la actualización, el tablero y su enlace
  siguen funcionando igual, con todas sus tareas y personas; recibe un nombre por defecto
  ("Mi tablero") que se puede cambiar.
- **Doble envío al crear un tablero** (pulsar "Crear" dos veces): se crea un solo tablero y
  se muestra un solo enlace.
- **Error o timeout al crear el tablero**: no se muestra ningún enlace; se conserva el nombre
  escrito y se ofrece "Reintentar". Si el tablero no llegó a crearse, el reintento lo crea y
  muestra su enlace. Si sí se creó, el reintento no crea otro y muestra "El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero.";
  el formulario conserva el nombre para crear uno nuevo. El tablero sin enlace queda huérfano:
  quien administra la instalación puede identificarlo (`board:list`) y borrarlo.
- **El usuario cierra el aviso del enlace sin copiarlo ni abrir el tablero**: se le pide
  confirmar "No podrás volver a ver este enlace. ¿Cerrar de todos modos?"; si cancela, el
  aviso sigue abierto con el enlace; si confirma, el tablero queda inaccesible desde la web (y
  se considera abandonado). Si ya copió el enlace o abrió el tablero, el aviso se cierra sin
  preguntar; desde el tablero siempre puede regenerarlo (FR-028b de la 001).
- **Abuso de la creación**: desde una misma red no se pueden crear más tableros por hora que
  el límite configurado (10 por defecto); al superarlo se muestra "Has creado demasiados tableros. Inténtalo más tarde." sin
  crear el tablero.
- **Nombres repetidos entre tableros**: se permiten; dos equipos pueden llamar igual a su
  tablero y nadie puede averiguar qué nombres existen.
- **Nombre con caracteres especiales o HTML**: se muestra como texto literal (FR-010 de la
  001), también en el título de la pestaña.
- **Cambio de nombre concurrente**: prevalece el último guardado; los demás ven el nombre
  nuevo al recargar.
- **Borrado del tablero mientras otra persona lo usa**: su siguiente operación falla con
  "Enlace no válido" y no se guarda nada; la interfaz muestra la página "Enlace no válido"
  (mismo comportamiento que tras regenerar el enlace en la 001), con la acción de crear un
  tablero nuevo.
- **Borrar o renombrar con un enlace ya regenerado**: falla con "Enlace no válido".
- **Pantalla de inicio en 320 px y con lector de pantalla**: crear un tablero y copiar el
  enlace es posible solo con teclado y sin desplazamiento horizontal.

## Requirements *(mandatory)*

### Functional Requirements

**Creación de tableros**

- **FR-101**: La instalación DEBE admitir varios tableros independientes. Cada tablero
  contiene sus propias tareas y personas con las tres columnas fijas de la 001 (sustituye a
  FR-001 de la 001).
- **FR-102**: Cualquier persona que acceda a la aplicación DEBE poder crear un tablero desde la
  pantalla de inicio indicando su nombre, sin registro ni inicio de sesión.
- **FR-103**: Al crearse un tablero, el sistema DEBE generar su enlace secreto con las mismas
  garantías que FR-028a de la 001 y mostrarlo **una sola vez** junto con una acción para
  copiarlo, un aviso de que no se volverá a mostrar y una acción para abrir el tablero. El
  sistema NO DEBE poder volver a mostrar ese enlace después.
- **FR-103a**: Si se intenta cerrar el aviso del enlace sin haberlo copiado ni haber abierto el
  tablero, el sistema DEBE pedir confirmación ("No podrás volver a ver este enlace. ¿Cerrar de
  todos modos?"); al cancelar, el aviso permanece abierto con el enlace.
- **FR-104**: Un doble envío o un reintento tras error al crear un tablero NO DEBE crear más de
  un tablero. Si el reintento corresponde a un tablero que ya se creó, el sistema NO DEBE
  volver a mostrar ni regenerar su enlace: DEBE informar de que el tablero se creó pero su
  enlace no se pudo mostrar y permitir crear otro.
- **FR-105**: El sistema DEBE limitar la creación de tableros por hora desde un mismo origen
  de red y rechazar las que excedan el límite con un mensaje comprensible, sin crear el
  tablero. El límite DEBE ser de 10 por hora por defecto y quien administra la instalación
  DEBE poder cambiarlo sin modificar el código.
- **FR-106**: Quien administra la instalación DEBE poder desactivar la creación de tableros
  desde la web; en ese caso, la pantalla de inicio no ofrece "Crear tablero" y la creación se
  rechaza.
- **FR-107**: La pantalla de inicio (sin enlace) y la página "Enlace no válido" DEBEN ofrecer
  la acción de crear un tablero (si la creación está activada) sin revelar información de
  ningún tablero existente.

**Aislamiento**

- **FR-108**: Cada enlace DEBE dar acceso exactamente a un tablero. Con el enlace de un
  tablero NO DEBE poder verse, crearse, modificarse, borrarse ni restaurarse ningún dato de
  otro tablero.
- **FR-109**: Una operación con el enlace de un tablero sobre una tarea o persona de otro
  tablero DEBE fallar igual que si el recurso no existiera, sin revelar que existe en otro
  tablero.
- **FR-110**: Las reglas de unicidad (nombre de persona, FR-016a de la 001), la búsqueda, los
  filtros y los recuentos DEBEN aplicarse dentro de cada tablero.
- **FR-111**: Regenerar el enlace de un tablero (FR-028b de la 001) NO DEBE afectar a los
  enlaces de otros tableros.

**Nombre del tablero**

- **FR-112**: Todo tablero DEBE tener un nombre visible de 1 a 60 caracteres tras eliminar los
  espacios en los extremos. No es necesario que sea único.
- **FR-113**: El nombre del tablero DEBE mostrarse en la cabecera del tablero y en el título
  de la pestaña del navegador, como texto literal.
- **FR-114**: Cualquier persona con el enlace vigente DEBE poder cambiar el nombre del
  tablero, con la misma validación que al crearlo (FR-112) y las reglas de guardado de la 001
  (FR-021, FR-021a).

**Borrado del tablero**

- **FR-115**: Cualquier persona con el enlace vigente DEBE poder borrar el tablero previa
  confirmación que muestre su nombre y el número de tareas y personas que se borrarán, y que
  exija escribir el nombre exacto del tablero para habilitar la acción.
- **FR-116**: Al borrarse un tablero, DEBEN borrarse de forma definitiva e inmediata todas sus
  tareas y personas, sin opción de deshacer ni de recuperarlas, y su enlace
  DEBE dejar de funcionar inmediatamente para todas las operaciones, respondiendo con el
  mensaje genérico "Enlace no válido" (FR-028c de la 001).
- **FR-117**: Borrar un tablero NO DEBE afectar a ningún otro tablero.

**Compatibilidad**

- **FR-118**: Al actualizar una instalación existente, su tablero DEBE conservar su enlace,
  tareas y personas, y recibir el nombre "Mi tablero".
- **FR-119**: Quien administra la instalación DEBE poder, desde la consola del servidor (sin
  necesidad del enlace):
  - crear un tablero con un nombre, mostrando su enlace una sola vez (necesario si la creación
    web está desactivada);
  - listar los tableros con identificador, nombre, fecha de creación, número de tareas y de
    personas y fecha de última actividad (el cambio más reciente en el tablero, sus tareas o
    sus personas), sin mostrar nunca códigos de acceso;
  - regenerar el enlace de un tablero indicado por su identificador (si un equipo pierde su
    enlace);
  - borrar un tablero indicado por su identificador, previa confirmación que muestre su nombre
    y el número de tareas y personas, con el mismo efecto que FR-116.
- **FR-119a**: Una operación de consola con un identificador inexistente DEBE fallar con un
  mensaje claro sin modificar ningún tablero.

**Interfaz**

- **FR-120**: La pantalla de inicio, el formulario de creación, el aviso del enlace, el cambio
  de nombre y la confirmación de borrado DEBEN cumplir los mismos requisitos de accesibilidad
  y adaptación a móviles que la 001 (FR-031–FR-034); el aviso del enlace DEBE anunciarse a
  tecnologías de asistencia y "Copiar enlace" DEBE confirmar la copia de forma accesible.

### Key Entities *(include if feature involves data)*

- **Tablero** (sustituye a la definición de la 001): espacio compartido de un equipo que
  contiene sus tareas y personas. Atributos: identificador, nombre visible (1–60 caracteres,
  no único), código de acceso vigente (secreto, regenerable, solo se muestra al crearlo o
  regenerarlo), fecha de creación y fecha de la última regeneración. Una instalación contiene
  cero o más tableros.
- **Tarea** y **Persona**: sin cambios respecto a la 001; cada una pertenece a exactamente un
  tablero y solo puede relacionarse con elementos del mismo tablero.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: Una persona sin experiencia previa crea un tablero, copia su enlace y crea la
  primera tarea en menos de 60 segundos desde que abre la aplicación.
- **SC-102**: En las pruebas de aislamiento, el 100% de los intentos de leer o modificar
  datos de otro tablero con un enlace válido de un tablero distinto fallan sin efectos.
- **SC-103**: En las pruebas de doble envío, reintento y error al crear, ningún envío ni
  reintento crea más de un tablero, y el enlace de un tablero nunca se muestra más de una vez.
- **SC-104**: Tras borrar un tablero, el 100% de las operaciones con su enlace responden
  "Enlace no válido" y no queda ninguna tarea ni persona suya accesible.
- **SC-105**: Una instalación existente actualizada conserva el 100% de sus tareas y personas
  y su enlace sigue funcionando.
- **SC-106**: Con 100 tableros en la instalación, abrir un tablero y operar sobre él cumple
  los mismos tiempos que SC-003 de la 001.
- **SC-107**: El 100% de las acciones nuevas (crear tablero, copiar enlace, cambiar nombre,
  borrar tablero) se completa solo con teclado, con lector de pantalla y a 320 px sin
  desplazamiento horizontal.

## Assumptions

- Sigue sin haber cuentas, roles ni inicio de sesión: quien tiene el enlace vigente de un
  tablero puede hacerlo todo en él, incluido renombrarlo y borrarlo (mismo riesgo aceptado
  que en la 001).
- Un enlace da acceso a un solo tablero; la aplicación no recuerda ni lista los tableros que
  una persona ha abierto. Quien pertenece a varios equipos guarda cada enlace por su cuenta.
- No hay una lista pública de tableros ni forma de buscar tableros por nombre.
- La creación desde la web está activada por defecto; quien administra la instalación puede
  desactivarla (FR-106).
- No hay límite global de tableros por instalación en esta versión; el abuso se contiene con
  el límite por origen de red (FR-105) y la posibilidad de desactivar la creación web.
- Los tableros cuyo enlace se perdió o que llevan tiempo sin uso no se limpian
  automáticamente en esta versión; quien administra la instalación los identifica con el
  listado de consola (última actividad) y los borra manualmente (FR-119).
- No se pueden mover ni copiar tareas o personas entre tableros.
- Volumen orientativo: hasta unos cientos de tableros por instalación, cada uno con el volumen
  de la 001 (≈15 personas, cientos de tareas).
- La interfaz sigue en español.

## Decisiones Pendientes

Todas resueltas en `plan.md` y aprobadas por el usuario el 2026-10-17.

**Seguridad**

1. ~~Creación pública de tableros sin autenticación~~ → D12 (límite por IP configurable,
   interruptor); sustituye a D4 de la 001. Excepción a la regla de autenticación justificada
   en plan.md, Complexity Tracking.
2. ~~Borrado del tablero por cualquier poseedor del enlace~~ → D14 (borrado físico e
   inmediato). Riesgo aceptado: un enlace filtrado permite borrar todos los datos sin vuelta
   atrás; solo las copias de seguridad (fuera de alcance) permitirían recuperarlos.

**Técnicas**

3. ~~Origen de red para el límite~~ → IP real según `TRUST_PROXY` (D11 de la 001, R18).
4. ~~Configuración y consola~~ → `BOARD_CREATION_ENABLED`, `BOARD_CREATION_PER_HOUR` (R18) y
   comandos `board:create`/`list`/`rotate --board`/`delete` (R23); última actividad derivada (R24).
5. ~~Migración del tablero existente~~ → D15 (`0005_board_name`, reversible).
