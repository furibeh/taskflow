import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiProvider } from '../api/ApiContext';
import { useBoard } from '../api/board';
import { createApiClient, type ApiClient } from '../api/client';
import { InvalidLinkPage } from '../features/access/InvalidLinkPage';
import { ShareLinkDialog } from '../features/access/ShareLinkDialog';
import { HomePage } from '../features/home/HomePage';
import { PeopleDialog } from '../features/people/PeopleDialog';
import { es } from '../i18n/es';
import { Button } from '../ui/Button';
import { LiveRegionProvider } from '../ui/LiveRegion';
import { getAccessCode, reloadAccessCodeFromHash, setAccessCode } from './access-code';
import { BoardPage } from './BoardPage';
import { createQueryClient } from './queryClient';

interface AppProps {
  /** Cliente ya construido: las pruebas del tablero lo inyectan y la app muestra el tablero. */
  readonly apiClient?: ApiClient;
  /** `fetch` simulado: las pruebas de inicio usan la app real con el código del fragmento. */
  readonly fetchImpl?: typeof fetch;
}

type View = 'home' | 'invalid' | 'board';

/** Cabecera y contenido del tablero abierto, con su nombre (FR-113). */
const OpenBoard = () => {
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const board = useBoard();
  const name = board.data?.name;

  useEffect(() => {
    document.title = name ? `«${name}» · ${es.appName}` : es.appName;
  }, [name]);

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__title">{name ?? es.appName}</h1>
        <nav className="app-header__actions" aria-label="Acciones del tablero">
          <Button onClick={() => setPeopleOpen(true)}>{es.people.open}</Button>
          <Button onClick={() => setShareOpen(true)}>{es.share.open}</Button>
        </nav>
      </header>
      <PeopleDialog open={peopleOpen} onClose={() => setPeopleOpen(false)} />
      <ShareLinkDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <BoardPage />
    </>
  );
};

export const App = ({ apiClient, fetchImpl }: AppProps) => {
  const [view, setView] = useState<View>(() => (apiClient || getAccessCode() !== null ? 'board' : 'home'));
  const [queryClient] = useState(createQueryClient);
  // Cada tablero abierto es una sesión nueva: se vuelve a montar con su código (US2).
  const [session, setSession] = useState(0);
  const [client] = useState(
    () =>
      apiClient ??
      createApiClient({
        getAccessCode,
        onInvalidLink: () => setView('invalid'),
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
  );

  // Fuera del tablero, el título de la pestaña vuelve a ser el de la aplicación.
  useEffect(() => {
    if (view !== 'board') document.title = es.appName;
  }, [view]);

  // Abrir otro tablero (enlace pegado o recién creado) descarta los datos del anterior.
  const knownCode = useRef(apiClient ? null : getAccessCode());
  const switchTo = useCallback(
    (code: string | null) => {
      knownCode.current = code;
      // Vaciar la caché no basta: las consultas ya montadas no siempre se repiten y la pantalla
      // podría seguir mostrando datos del tablero anterior.
      queryClient.clear();
      setSession((n) => n + 1);
      setView(code === null ? 'home' : 'board');
    },
    [queryClient],
  );

  // Pegar otro enlace en la misma pestaña solo cambia el fragmento (#k=…), sin recargar.
  useEffect(() => {
    if (apiClient) return;
    const onHashChange = () => {
      const next = reloadAccessCodeFromHash();
      if (next !== knownCode.current) switchTo(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [apiClient, switchTo]);

  const openBoard = (code: string) => {
    setAccessCode(code);
    switchTo(code);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={client}>
        <LiveRegionProvider>
          {view === 'home' && <HomePage onOpenBoard={openBoard} />}
          {view === 'invalid' && <InvalidLinkPage onOpenBoard={openBoard} />}
          {view === 'board' && <OpenBoard key={session} />}
        </LiveRegionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};
