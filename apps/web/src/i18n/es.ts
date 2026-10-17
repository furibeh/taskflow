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
  BOARD_CREATION_DISABLED:
    'En esta instalación no se pueden crear tableros desde la web. Pide el enlace a tu equipo.',
  BOARD_CREATION_LIMITED: 'Has creado demasiados tableros. Inténtalo más tarde.',
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
  share: {
    open: 'Compartir',
    title: 'Compartir el tablero',
    intro: 'Cualquier persona con este enlace puede ver y modificar el tablero. Compártelo solo con tu equipo.',
    link: 'Enlace del tablero',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado',
    copyFailed: 'No se pudo copiar. Selecciona el enlace y cópialo manualmente.',
    regenerate: 'Regenerar enlace',
    regenerateWarning:
      'El enlace actual dejará de funcionar inmediatamente para todo el equipo. Tendrás que compartir el nuevo.',
    confirmRegenerate: 'Regenerar',
    cancel: 'Cancelar',
    regenerated: 'Enlace regenerado. Comparte el nuevo enlace con tu equipo.',
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
  edit: {
    edit: 'Editar',
    save: 'Guardar',
    cancel: 'Cancelar',
    title: 'Título',
    description: 'Descripción',
    saved: 'Cambios guardados',
  },
  remove: {
    remove: 'Borrar',
    confirm: (title: string) => `¿Borrar la tarea «${title}»?`,
    confirmButton: 'Borrar tarea',
    cancel: 'Cancelar',
    deleted: 'Tarea borrada',
    undo: 'Deshacer',
    restored: 'Tarea restaurada',
    expired: 'Ya no se puede deshacer',
  },
  home: {
    title: 'Tableros de tareas para tu equipo',
    intro: 'Para entrar en el tablero de tu equipo necesitas su enlace. Pídeselo a alguien del equipo.',
    creationDisabled: 'Para entrar en un tablero, pide el enlace a tu equipo.',
    create: 'Crear tablero',
    createNew: 'Crear un tablero nuevo',
  },
  createBoard: {
    heading: 'Nuevo tablero',
    name: 'Nombre del tablero',
    submit: 'Crear tablero',
    nameRequired: 'El nombre es obligatorio.',
    conflict: 'No se pudo crear el tablero. Inténtalo de nuevo.',
    lostLink: 'El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero.',
  },
  newBoardLink: {
    title: (name: string) => `Tablero «${name}» creado`,
    warning: 'Guarda este enlace: no se volverá a mostrar.',
    link: 'Enlace del tablero',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado',
    open: 'Abrir tablero',
    confirmClose: 'No podrás volver a ver este enlace. ¿Cerrar de todos modos?',
    closeAnyway: 'Cerrar de todos modos',
    cancel: 'Cancelar',
  },
  boardMenu: {
    open: 'Tablero',
    rename: 'Cambiar nombre',
    delete: 'Borrar tablero',
    renamed: 'Nombre del tablero cambiado',
    deleted: (name: string) => `Tablero «${name}» borrado`,
    deleteWarning: (name: string, tasks: number, people: number) =>
      `Se borrará el tablero «${name}» con ${tasks === 1 ? '1 tarea' : `${tasks} tareas`} y ${
        people === 1 ? '1 persona' : `${people} personas`
      }. No se puede deshacer.`,
    confirmName: (name: string) => `Escribe «${name}» para confirmar`,
    confirmDelete: 'Borrar tablero',
    save: 'Guardar',
    cancel: 'Cancelar',
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
