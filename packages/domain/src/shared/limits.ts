// Límites de la spec (FR-009, FR-016a, FR-024b, FR-013c, FR-021a). Fuente única para el dominio,
// los contratos HTTP y las comprobaciones de la interfaz.
export const TITLE_MIN = 1;
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const PERSON_NAME_MIN = 1;
export const PERSON_NAME_MAX = 50;
export const SEARCH_MAX = 100;
export const UNDO_WINDOW_UI_MS = 10_000;
export const UNDO_WINDOW_SERVER_MS = 15_000;
export const CLIENT_TIMEOUT_MS = 10_000;
// Nombre del tablero (feature 002, FR-112, FR-118).
export const BOARD_NAME_MIN = 1;
export const BOARD_NAME_MAX = 60;
export const DEFAULT_BOARD_NAME = 'Mi tablero';
