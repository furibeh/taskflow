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
  detail: {
    status: 'Estado',
    assignee: 'Responsable',
    createdAt: 'Creada',
    description: 'Descripción',
    noDescription: 'Sin descripción.',
    open: (title: string) => `Ver detalle de «${title}»`,
  },
};
