// El código de acceso vive solo en el fragmento de la URL (#k=...) y en memoria: el fragmento
// nunca se envía al servidor ni aparece en Referer (research.md R7). Nunca se registra en logs.
let accessCode: string | null = null;

const readFromHash = (): string | null => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('k');
  return code && code.trim() ? code.trim() : null;
};

export const getAccessCode = (): string | null => {
  if (accessCode === null) accessCode = readFromHash();
  return accessCode;
};

/** Sustituye el código (p. ej., tras regenerar el enlace) sin recargar ni añadir historial. */
export const setAccessCode = (code: string): void => {
  accessCode = code;
  const url = new URL(window.location.href);
  url.hash = `k=${code}`;
  window.history.replaceState(window.history.state, '', url);
};

/** Olvida el código y lo quita del fragmento (p. ej., tras borrar el tablero). */
export const clearAccessCode = (): void => {
  accessCode = null;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(window.history.state, '', url);
};

/** Vuelve a leer el código del fragmento (p. ej., tras pegar un enlace en la misma pestaña). */
export const reloadAccessCodeFromHash = (): string | null => {
  accessCode = readFromHash();
  return accessCode;
};

/** Solo para pruebas. */
export const resetAccessCodeForTests = (): void => {
  accessCode = null;
};
