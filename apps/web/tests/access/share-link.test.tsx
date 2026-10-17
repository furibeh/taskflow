import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getAccessCode, resetAccessCodeForTests, setAccessCode } from '../../src/app/access-code';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

describe('compartir y regenerar el enlace (FR-028b)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    resetAccessCodeForTests();
  });

  it('muestra el enlace actual y, tras confirmar, lo sustituye por el nuevo', async () => {
    setAccessCode('A'.repeat(43));
    const user = userEvent.setup();
    const server = createFakeServer();
    renderApp(server);

    await user.click(await screen.findByRole('button', { name: 'Compartir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compartir el tablero' });
    const link = within(dialog).getByLabelText('Enlace del tablero');
    expect(link).toHaveValue(`${window.location.origin}/#k=${'A'.repeat(43)}`);
    await expectNoAxeViolations(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Regenerar enlace' }));
    expect(within(dialog).getByText(/dejará de funcionar inmediatamente/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(server.requests('POST')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Regenerar enlace' }));
    await user.click(within(dialog).getByRole('button', { name: 'Regenerar' }));

    await waitFor(() => expect(link).toHaveValue(`${window.location.origin}/#k=${'N'.repeat(43)}`));
    expect(getAccessCode()).toBe('N'.repeat(43));
    expect(window.location.hash).toBe(`#k=${'N'.repeat(43)}`);
    await waitFor(() =>
      expect(screen.getByTestId('live-region')).toHaveTextContent('Enlace regenerado. Comparte el nuevo enlace'),
    );
  });
});
