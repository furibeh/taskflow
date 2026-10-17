import { render } from '@testing-library/react';
import { createApiClient } from '../../src/api/client';
import { App } from '../../src/app/App';
import { createFakeServer, type FakeServer } from './fake-server';

export const renderApp = (server: FakeServer = createFakeServer()) => {
  const apiClient = createApiClient({
    getAccessCode: () => 'codigo-de-prueba',
    fetchImpl: server.fetchImpl as unknown as typeof fetch,
  });
  return { server, ...render(<App apiClient={apiClient} />) };
};
