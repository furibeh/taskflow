import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { setViewportWide } from '../setup';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });

describe('cambio de estado con el selector (US2)', () => {
  it('el selector tiene nombre accesible, muestra "Guardando…" y mueve la tarjeta al confirmarse', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    const { container } = renderApp(server);

    const select = await screen.findByRole('combobox', { name: 'Estado de «Preparar demo»' });
    expect(select).toHaveValue('pending');

    const release = server.holdWrites();
    await user.selectOptions(select, 'in_progress');

    expect(await within(column('Pendiente')).findByText('Guardando…')).toBeInTheDocument();
    expect(select).toBeDisabled();
    expect(within(column('En progreso')).queryByText('Preparar demo')).not.toBeInTheDocument();

    release();
    await waitFor(() =>
      expect(within(column('En progreso')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument(),
    );
    expect(within(column('Pendiente')).queryByText('Preparar demo')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea movida a En progreso'),
    );
    expect(server.requests('PATCH')[0]?.body).toEqual({ status: 'in_progress' });
    await expectNoAxeViolations(container);
  });

  it('si falla, la tarjeta se queda en su columna y "Reintentar" repite el cambio', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    server.failNextWithNetworkError();
    await user.selectOptions(await screen.findByRole('combobox', { name: /Estado de/ }), 'done');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar. Revisa tu conexión.');
    expect(within(column('Pendiente')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument();
    expect(server.tasks[0]?.status).toBe('pending');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() =>
      expect(within(column('Hecha')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si la tarea ya no existe, avisa y recarga el tablero', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Borrada por otra persona' });
    renderApp(server);

    const select = await screen.findByRole('combobox', { name: /Estado de/ });
    server.tasks.splice(0, 1);
    await user.selectOptions(select, 'done');

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta tarea ya no existe.');
    await waitFor(() => expect(screen.queryByText('Borrada por otra persona')).not.toBeInTheDocument());
  });

  it('el selector también está disponible en pantallas estrechas', async () => {
    setViewportWide(false);
    try {
      const server = createFakeServer();
      server.addTask({ title: 'Preparar demo' });
      renderApp(server);
      expect(await screen.findByRole('combobox', { name: /Estado de/ })).toBeInTheDocument();
    } finally {
      setViewportWide(true);
    }
  });
});
