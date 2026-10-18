import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAccessCodeForTests, setAccessCode } from '../../src/app/access-code';
import { App } from '../../src/app/App';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer, type FakeServer } from '../support/fake-server';

const CODE = 'A'.repeat(43);

const renderBoard = async (server: FakeServer = createFakeServer()) => {
  setAccessCode(CODE);
  render(<App fetchImpl={server.fetchImpl as unknown as typeof fetch} />);
  await screen.findByRole('heading', { level: 1, name: 'Mi tablero' });
  return server;
};

const openMenuItem = async (user: ReturnType<typeof userEvent.setup>, item: string) => {
  await user.click(screen.getByRole('button', { name: 'Tablero' }));
  await user.click(screen.getByRole('button', { name: item }));
  return screen.findByRole('dialog', { name: item });
};

describe('gestionar el tablero desde la cabecera', () => {
  beforeEach(() => {
    document.title = 'TaskFlow';
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    resetAccessCodeForTests();
  });

  describe('cambiar el nombre (US3, FR-114)', () => {
    it('el menú "Tablero" abre "Cambiar nombre" con el nombre actual', async () => {
      const user = userEvent.setup();
      await renderBoard();

      const menuButton = screen.getByRole('button', { name: 'Tablero' });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await user.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Cambiar nombre' }));

      const dialog = await screen.findByRole('dialog', { name: 'Cambiar nombre' });
      expect(within(dialog).getByLabelText('Nombre del tablero')).toHaveValue('Mi tablero');
      await expectNoAxeViolations(dialog);
    });

    it('valida el nombre junto al campo sin enviar nada', async () => {
      const user = userEvent.setup();
      const server = await renderBoard();
      const dialog = await openMenuItem(user, 'Cambiar nombre');
      const field = within(dialog).getByLabelText('Nombre del tablero');

      await user.clear(field);
      await user.type(field, '   ');
      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      expect(within(dialog).getByText('El nombre es obligatorio.')).toBeVisible();
      expect(field).toHaveAttribute('aria-invalid', 'true');

      await user.clear(field);
      await user.type(field, 'a'.repeat(61));
      expect(field).toHaveValue('a'.repeat(60));
      expect(server.requests('PATCH')).toHaveLength(0);
    });

    it('la cabecera y la pestaña cambian solo cuando el servidor confirma el guardado', async () => {
      const user = userEvent.setup();
      const server = await renderBoard();
      await waitFor(() => expect(document.title).toBe('«Mi tablero» · TaskFlow'));
      const dialog = await openMenuItem(user, 'Cambiar nombre');
      const field = within(dialog).getByLabelText('Nombre del tablero');
      await user.clear(field);
      await user.type(field, '  Diseño y UX ');

      const release = server.holdWrites();
      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      expect(await within(dialog).findByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi tablero');
      release();

      expect(await screen.findByRole('heading', { level: 1, name: 'Diseño y UX' })).toBeVisible();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(document.title).toBe('«Diseño y UX» · TaskFlow'));
      await waitFor(() =>
        expect(screen.getByTestId('live-region')).toHaveTextContent('Nombre del tablero cambiado'),
      );
      expect(server.requests('PATCH')[0]?.body).toEqual({ name: '  Diseño y UX ' });
    });

    it('si falla, el nombre no cambia, se conserva lo escrito y se puede reintentar', async () => {
      const user = userEvent.setup();
      const server = await renderBoard();
      const dialog = await openMenuItem(user, 'Cambiar nombre');
      const field = within(dialog).getByLabelText('Nombre del tablero');
      await user.clear(field);
      await user.type(field, 'Diseño y UX');
      server.failNextWithNetworkError();
      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo guardar. Revisa tu conexión.');
      expect(field).toHaveValue('Diseño y UX');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi tablero');

      await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Diseño y UX' })).toBeVisible();
    });

    it('si el tablero ya no existe, muestra "Enlace no válido"', async () => {
      const user = userEvent.setup();
      const server = await renderBoard();
      const dialog = await openMenuItem(user, 'Cambiar nombre');
      server.rejectCode(CODE);
      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
    });
  });

  describe('borrar el tablero (US4, FR-115, FR-116)', () => {
    const withData = () => {
      const server = createFakeServer();
      server.addPerson('Ana');
      server.addTask({ title: 'Una' });
      server.addTask({ title: 'Dos' });
      return server;
    };

    it('la confirmación muestra el nombre, los recuentos y que no se puede deshacer', async () => {
      const user = userEvent.setup();
      await renderBoard(withData());
      const dialog = await openMenuItem(user, 'Borrar tablero');

      expect(
        within(dialog).getByText('Se borrará el tablero «Mi tablero» con 2 tareas y 1 persona. No se puede deshacer.'),
      ).toBeVisible();
      await expectNoAxeViolations(dialog);
    });

    it('el botón solo se activa al escribir el nombre exacto', async () => {
      const user = userEvent.setup();
      const server = await renderBoard(withData());
      const dialog = await openMenuItem(user, 'Borrar tablero');
      const confirm = within(dialog).getByLabelText('Escribe «Mi tablero» para confirmar');
      const button = within(dialog).getByRole('button', { name: 'Borrar tablero' });

      expect(button).toBeDisabled();
      await user.type(confirm, 'mi tablero');
      expect(button).toBeDisabled();
      await user.clear(confirm);
      await user.type(confirm, '  Mi tablero ');
      expect(button).toBeEnabled();
      expect(server.requests('DELETE')).toHaveLength(0);
    });

    it('al borrar vuelve al inicio con el aviso y sin el código en el fragmento', async () => {
      const user = userEvent.setup();
      const server = await renderBoard(withData());
      await waitFor(() => expect(document.title).toBe('«Mi tablero» · TaskFlow'));
      const dialog = await openMenuItem(user, 'Borrar tablero');
      await user.type(within(dialog).getByLabelText('Escribe «Mi tablero» para confirmar'), 'Mi tablero');

      const release = server.holdWrites();
      await user.click(within(dialog).getByRole('button', { name: 'Borrar tablero' }));
      expect(await within(dialog).findByRole('button', { name: 'Guardando…' })).toBeDisabled();
      release();

      expect(await screen.findByRole('heading', { level: 1, name: 'Tableros de tareas para tu equipo' })).toBeVisible();
      expect(screen.getByText('Tablero «Mi tablero» borrado', { selector: '.home__notice' })).toBeVisible();
      await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Tablero «Mi tablero» borrado'));
      expect(window.location.hash).toBe('');
      expect(document.title).toBe('TaskFlow');
      expect(server.requests('DELETE')).toHaveLength(1);
    });

    it('si falla, ofrece reintentar y no cambia nada', async () => {
      const user = userEvent.setup();
      const server = await renderBoard(withData());
      const dialog = await openMenuItem(user, 'Borrar tablero');
      await user.type(within(dialog).getByLabelText('Escribe «Mi tablero» para confirmar'), 'Mi tablero');
      server.failNextWithNetworkError();
      await user.click(within(dialog).getByRole('button', { name: 'Borrar tablero' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo guardar. Revisa tu conexión.');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi tablero');
      expect(window.location.hash).toBe(`#k=${CODE}`);

      await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Tableros de tareas para tu equipo' })).toBeVisible();
    });
  });
});
