import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiProvider } from '../api/ApiContext';
import { createApiClient, type ApiClient } from '../api/client';
import { InvalidLinkPage } from '../features/access/InvalidLinkPage';
import { es } from '../i18n/es';
import { LiveRegionProvider } from '../ui/LiveRegion';
import { getAccessCode } from './access-code';
import { BoardPage } from './BoardPage';
import { createQueryClient } from './queryClient';

interface AppProps {
  /** Permite inyectar un cliente en pruebas. */
  readonly apiClient?: ApiClient;
}

export const App = ({ apiClient }: AppProps) => {
  const [invalidLink, setInvalidLink] = useState(() => !apiClient && getAccessCode() === null);
  const [queryClient] = useState(createQueryClient);
  const [client] = useState(
    () => apiClient ?? createApiClient({ getAccessCode, onInvalidLink: () => setInvalidLink(true) }),
  );

  if (invalidLink) return <InvalidLinkPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={client}>
        <LiveRegionProvider>
          <header className="app-header">
            <h1 className="app-header__title">{es.appName}</h1>
          </header>
          <BoardPage />
        </LiveRegionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};
