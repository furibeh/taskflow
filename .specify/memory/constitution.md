# TaskFlow Constitution

TaskFlow es una aplicación web cuyo objetivo es que equipos puedan gestionar tareas mediante un
tablero kanban. Esta constitución define las reglas no negociables que rigen su diseño,
desarrollo y mantenimiento.

## Core Principles

### I. Código Modular y Mantenible

- El código DEBE organizarse en módulos con una responsabilidad única y bien delimitada
  (p. ej., tableros, columnas, tareas, usuarios/equipos).
- Cada módulo DEBE exponer una interfaz pública explícita; otros módulos NO DEBEN depender de
  sus detalles internos.
- Las dependencias entre módulos DEBEN ser unidireccionales y sin ciclos.
- La duplicación de lógica DEBE extraerse a un módulo compartido cuando aparezca en más de un
  lugar con el mismo propósito.

**Razón**: un tablero kanban evoluciona por funcionalidades (etiquetas, asignaciones,
comentarios…); módulos acotados permiten cambiar una parte sin romper las demás.

### II. Lógica de Negocio Independiente de la Interfaz

- Las reglas de negocio (p. ej., mover una tarea entre columnas, permisos de un miembro del
  equipo, límites WIP) DEBEN residir en una capa de dominio/servicios que no importe ni conozca
  componentes de UI, frameworks de presentación ni detalles de transporte HTTP.
- La interfaz (web, API) DEBE limitarse a recoger entradas, invocar la capa de dominio y
  presentar resultados.
- La capa de dominio DEBE poder ejecutarse y probarse sin levantar la interfaz.

**Razón**: desacoplar dominio e interfaz permite probar las reglas de forma aislada y cambiar
o añadir interfaces sin reescribir la lógica.

### III. Validación de Toda Entrada del Usuario

- Toda entrada proveniente del usuario o de clientes externos (formularios, parámetros de URL,
  cuerpos de peticiones, cabeceras, archivos) DEBE validarse en el servidor antes de usarse,
  aunque también se valide en el cliente.
- La validación DEBE cubrir tipo, formato, longitud, rango y pertenencia/autorización del
  recurso (p. ej., que la tarea pertenezca a un tablero del equipo del usuario).
- Las entradas inválidas DEBEN rechazarse con un error claro y sin efectos secundarios.

**Razón**: la validación en el servidor es la barrera principal contra datos corruptos e
inyecciones, y protege la integridad de los tableros compartidos entre equipos.

### IV. Pruebas Automatizadas de Operaciones Importantes (NO NEGOCIABLE)

- Las operaciones importantes DEBEN tener pruebas automatizadas. Como mínimo: crear, editar,
  mover y eliminar tareas; gestión de tableros y columnas; autenticación y autorización;
  validación de entradas; y migraciones de base de datos.
- Toda corrección de un defecto DEBE incluir una prueba que reproduzca el defecto.
- Las pruebas DEBEN poder ejecutarse de forma automática y repetible con un único comando.

**Razón**: las pruebas son la evidencia objetiva de que el sistema funciona; sin ellas no es
posible afirmar que un cambio es correcto.

### V. Secretos Fuera del Repositorio

- NO DEBEN almacenarse en el repositorio secretos de ningún tipo: contraseñas, claves de API,
  tokens, certificados privados, cadenas de conexión con credenciales ni archivos `.env` reales.
- Los secretos DEBEN proveerse mediante variables de entorno o un gestor de secretos.
- El repositorio PUEDE incluir archivos de ejemplo (p. ej., `.env.example`) solo con valores
  ficticios.
- Si un secreto llega a publicarse en el repositorio, DEBE considerarse comprometido y rotarse
  de inmediato.

**Razón**: el historial de git es permanente y se replica; un secreto filtrado expone los datos
de todos los equipos.

### VI. Cambios de Base de Datos mediante Migraciones

- Todo cambio de esquema o de datos estructurales DEBE realizarse mediante una migración
  versionada incluida en el repositorio, junto al cambio de código que la requiere.
- NO DEBEN aplicarse cambios manuales al esquema en ningún entorno compartido.
- Las migraciones DEBEN ser reproducibles y, cuando sea viable, reversibles; si una migración
  no es reversible, DEBE indicarse explícitamente.

**Razón**: las migraciones garantizan que todos los entornos tengan el mismo esquema y que los
cambios sean auditables y repetibles.

## Requisitos de Seguridad y Datos

- Autenticación y autorización DEBEN verificarse en el servidor para cada operación sobre
  tableros, columnas y tareas; un usuario solo DEBE acceder a los recursos de sus equipos.
- Las dependencias externas DEBEN mantenerse actualizadas y revisarse ante vulnerabilidades
  conocidas.
- Los errores mostrados al usuario NO DEBEN filtrar detalles internos (trazas, consultas SQL,
  rutas o secretos).

## Flujo de Desarrollo y Criterios de Finalización

- **Definición de terminado**: una tarea NO DEBE declararse terminada si las pruebas
  correspondientes fallan o no se han ejecutado. Para declararla terminada, las pruebas
  relevantes DEBEN haberse ejecutado y pasado, y el resultado DEBE reportarse con fidelidad.
- **Decisiones de arquitectura o seguridad**: toda decisión que afecte a la arquitectura
  (estructura de módulos, capas, tecnologías, modelo de datos) o a la seguridad
  (autenticación, autorización, manejo de datos sensibles, dependencias críticas) DEBE
  explicarse antes de aplicarse, indicando el problema, la opción elegida, las alternativas
  consideradas y su impacto. No se aplica hasta que la explicación haya sido presentada.
- Cada cambio DEBE revisarse contra estos principios antes de integrarse.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o guía del proyecto. En caso de
  conflicto, rige la constitución.
- **Enmiendas**: cualquier modificación DEBE documentarse en este archivo, justificar el motivo
  y actualizar la versión y la fecha de última enmienda. Los cambios que afecten a planes,
  especificaciones o tareas en curso DEBEN incluir un plan de adaptación.
- **Versionado** (semántico):
  - MAJOR: eliminación o redefinición incompatible de principios o reglas de gobierno.
  - MINOR: nuevo principio o sección, o ampliación material de una guía existente.
  - PATCH: aclaraciones, redacción o correcciones sin cambio semántico.
- **Cumplimiento**: cada especificación, plan y revisión de código DEBE verificar el
  cumplimiento de estos principios. Cualquier excepción DEBE justificarse por escrito en el
  plan correspondiente.

**Version**: 1.0.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
