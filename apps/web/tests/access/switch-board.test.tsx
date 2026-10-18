import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetAccessCodeForTests, setAccessCode } from '../../src/app/access-code';
import { App } from '../../src/app/App';
import { createFakeServer } from '../support/fake-server';

describe('pegar el enlace de otro tablero en la misma pestaña (US2)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    resetAccessCodeForTests();
  });

  it('muestra el tablero nuevo y nunca datos del anterior', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Tarea de Mi tablero' });
    setAccessCode('A'.repeat(43));
    render(<App fetchImpl={server.fetchImpl as unknown as typeof fetch} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi tablero' })).toBeVisible();

    // Se crea otro tablero desde la consola del fake y se pega su enlace en la pestaña.
    server.board.name = 'Equipo B';
    server.tasks.length = 0;
    window.location.hash = `k=${'B'.repeat(43)}`;

    expect(await screen.findByRole('heading', { level: 1, name: 'Equipo B' })).toBeVisible();
    const board = await screen.findByRole('region', { name: 'Tablero de tareas' });
    expect(within(board).queryByText('Tarea de Mi tablero')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compartir' }));
    expect(screen.getByLabelText('Enlace del tablero')).toHaveValue(`${window.location.origin}/#k=${'B'.repeat(43)}`);
  });
});
