// Reglas puras del dominio que la interfaz reutiliza para dar respuesta inmediata (R5).
// El servidor siempre vuelve a validar.
export {
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MAX,
  PERSON_NAME_MIN,
  PERSON_NAME_MAX,
  BOARD_NAME_MIN,
  BOARD_NAME_MAX,
  SEARCH_MAX,
  UNDO_WINDOW_UI_MS,
  CLIENT_TIMEOUT_MS,
  normalizeText,
  charLength,
  checkLength,
} from '@taskflow/domain';
