import { es } from '../../i18n/es';

/** Página genérica sin ningún dato del tablero (FR-028c). */
export const InvalidLinkPage = () => (
  <main className="invalid-link">
    <h1>{es.invalidLink.title}</h1>
    <p>{es.invalidLink.body}</p>
  </main>
);
