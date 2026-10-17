import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

describe('límite de peticiones (T131)', () => {
  it('un 429 al crear muestra el mensaje de espera y permite reintentar', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    renderApp(server);
    await screen.findByText(/Todavía no hay tareas/);

    server.failNextWith(429, 'RATE_LIMITED');
    await user.type(screen.getByLabelText('Título'), 'Preparar demo');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Demasiadas acciones seguidas. Espera unos segundos.');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Preparar demo' })).toBeInTheDocument();
  });
});
