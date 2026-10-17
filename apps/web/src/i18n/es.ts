import type { ClientErrorCode } from '../api/client';

export type TaskStatus = 'pending' | 'in_progress' | 'done';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Hecha',
};

// Mensajes de la tabla "Validación y manejo de errores" de plan.md.
const ERROR_MESSAGES: Record<ClientErrorCode, string> = {
  VALIDATION_ERROR: 'Revisa los datos del formulario.',
  INVALID_LINK: 'Enlace no válido. Pide el enlace actual a tu equipo.',
  TASK_NOT_FOUND: 'Esta tarea ya no existe.',
  PERSON_NOT_FOUND: 'Esta persona ya no está en el equipo.',
  ASSIGNEE_NOT_FOUND: 'La persona elegida ya no está en el equipo.',
  PERSON_NAME_TAKEN: 'Ya existe una persona con ese nombre.',
  ID_CONFLICT: 'No se pudo guardar. Inténtalo de nuevo.',
  UNDO_EXPIRED: 'Ya no se puede deshacer.',
  NOT_FOUND: 'No se encontró lo que buscabas.',
  RATE_LIMITED: 'Demasiadas acciones seguidas. Espera unos segundos.',
  SERVICE_UNAVAILABLE: 'No se pudo guardar. Revisa tu conexión.',
  INTERNAL_ERROR: 'No se pudo guardar. Revisa tu conexión.',
  TIMEOUT: 'No se pudo guardar. Revisa tu conexión.',
  NETWORK: 'No se pudo guardar. Revisa tu conexión.',
  INVALID_RESPONSE: 'No se pudo guardar. Revisa tu conexión.',
};

export const errorMessage = (code: ClientErrorCode): string => ERROR_MESSAGES[code];

export const es = {
  appName: 'TaskFlow',
  saving: 'Guardando…',
  retry: 'Reintentar',
  close: 'Cerrar',
  unassigned: 'Sin asignar',
  loadError: 'No se pudo cargar el tablero. Revisa tu conexión.',
  loading: 'Cargando tablero…',
  invalidLink: {
    title: 'Enlace no válido',
    body: 'Este enlace no da acceso a ningún tablero. Pide el enlace actual a tu equipo.',
  },
  board: {
    label: 'Tablero de tareas',
    emptyBoard: 'Todavía no hay tareas. Crea la primera con el formulario «Nueva tarea».',
    emptyColumn: 'No hay tareas en esta columna.',
    columnCount: (n: number) => (n === 1 ? '1 tarea' : `${n} tareas`),
  },
  createTask: {
    heading: 'Nueva tarea',
    title: 'Título',
    description: 'Descripción (opcional)',
    submit: 'Crear tarea',
    created: 'Tarea creada',
    counter: (n: number, max: number) => `${n}/${max}`,
  },
  validation: {
    titleRequired: 'El título es obligatorio.',
    tooLong: (max: number) => `Máximo ${max} caracteres.`,
  },
  people: {
    open: 'Personas',
    title: 'Personas del equipo',
    empty: 'Todavía no hay personas. Añade a quien vaya a recibir tareas.',
    name: 'Nombre',
    add: 'Añadir',
    added: (name: string) => `${name} añadida al equipo`,
    removed: (name: string) => `${name} quitado del equipo`,
    remove: (name: string) => `Quitar a ${name}`,
    confirmRemove: 'Quitar',
    cancel: 'Cancelar',
    assigned: (n: number) => (n === 1 ? '1 tarea asignada' : `${n} tareas asignadas`),
    removeWarning: (name: string, n: number) =>
      n === 0
        ? `Se quitará a ${name}. No tiene tareas asignadas.`
        : `Se quitará a ${name}. ${n === 1 ? '1 tarea quedará' : `${n} tareas quedarán`} sin asignar.`,
    nameRequired: 'El nombre es obligatorio.',
    listLabel: 'Personas',
  },
  filters: {
    heading: 'Búsqueda y filtros',
    search: 'Buscar tareas',
    byAssignee: 'Filtrar por responsable',
    all: 'Todos',
    assignee: 'Responsable',
    statuses: 'Estados',
    active: 'Filtros activos',
    clearAll: 'Limpiar todo',
    clearSearchAndFilters: 'Limpiar búsqueda y filtros',
    noResultsSearch: (text: string) => `No hay tareas que coincidan con «${text}»`,
    noResultsFilters: 'No hay tareas que coincidan con los filtros',
    hiddenCreated: 'La tarea se ha creado, pero no se muestra por los filtros activos.',
  },
  assign: {
    label: 'Responsable',
    optionalLabel: 'Responsable (opcional)',
    hintEmpty: 'Añade personas desde «Personas».',
    assignedTo: (name: string) => `Tarea asignada a ${name}`,
    unassigned: 'Tarea sin asignar',
  },
  move: {
    statusLabel: 'Estado',
    statusOf: (title: string) => `de «${title}»`,
    moved: (column: string) => `Tarea movida a ${column}`,
    handle: (title: string) => `Mover «${title}»`,
    instructions:
      'Pulsa Espacio para coger la tarea, las flechas izquierda y derecha para elegir columna y Espacio para soltarla. Escape cancela.',
    pickedUp: (column: string) => `Tarea cogida. Columna actual: ${column}.`,
    over: (column: string) => `Sobre ${column}`,
    dropped: (column: string) => `Tarea soltada en ${column}`,
    droppedUnchanged: 'Tarea soltada sin cambios',
    cancelled: 'Movimiento cancelado',
  },
  detail: {
    status: 'Estado',
    assignee: 'Responsable',
    createdAt: 'Creada',
    description: 'Descripción',
    noDescription: 'Sin descripción.',
    open: (title: string) => `Ver detalle de «${title}»`,
  },
};
