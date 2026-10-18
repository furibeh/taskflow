import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getAccessCode, resetAccessCodeForTests, setAccessCode } from '../../src/app/access-code';
import { App } from '../../src/app/App';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer, type FakeServer } from '../support/fake-server';

const CODE_1 = '1'.padStart(43, 'C');

/** La App real, con el código leído del fragmento y solo `fetch` simulado. */
const renderHome = (server: FakeServer = createFakeServer()) => {
  render(<App fetchImpl={server.fetchImpl as unknown as typeof fetch} />);
  return server;
};

const nameField = () => screen.getByLabelText('Nombre del tablero');
const createButton = () => screen.getByRole('button', { name: 'Crear tablero' });

describe('pantalla de inicio y creación de tableros (US1)', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    resetAccessCodeForTests();
    document.title = 'TaskFlow';
  });

  it('sin código muestra el inicio con la explicación del enlace y el formulario de creación', async () => {
    renderHome();

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableros de tareas para tu equipo' })).toBeVisible();
    expect(screen.getByText(/necesitas su enlace/)).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Crear tablero' })).toBeVisible();
    expect(document.title).toBe('TaskFlow');
    await expectNoAxeViolations(document.body);
  });

  it('con la creación desactivada no ofrece crear tableros (FR-106)', async () => {
    const server = createFakeServer();
    server.disableBoardCreation();
    renderHome(server);

    expect(await screen.findByText('Para entrar en un tablero, pide el enlace a tu equipo.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear tablero' })).not.toBeInTheDocument();
  });

  it('un enlace no válido ofrece crear un tablero nuevo sin mostrar datos (FR-107)', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.rejectCode('incorrecto');
    setAccessCode('incorrecto');
    renderHome(server);

    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Tablero de tareas' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Crear un tablero nuevo' }));
    expect(nameField()).toBeVisible();
  });

  it('valida el nombre sin enviar nada y limita la longitud a 60 caracteres', async () => {
    const user = userEvent.setup();
    const server = renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });

    await user.type(nameField(), '   ');
    await user.click(createButton());
    expect(screen.getByText('El nombre es obligatorio.')).toBeVisible();
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(nameField()).toHaveFocus();

    await user.clear(nameField());
    await user.type(nameField(), 'a'.repeat(61));
    expect(nameField()).toHaveValue('a'.repeat(60));
    expect(server.requests('POST')).toHaveLength(0);
  });

  it('crea el tablero, muestra el enlace una vez, lo copia y abre el tablero con su nombre', async () => {
    const user = userEvent.setup();
    const server = renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });

    await user.type(nameField(), '  Equipo Diseño ');
    const release = server.holdWrites();
    await user.click(createButton());
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
    release();

    const dialog = await screen.findByRole('dialog', { name: 'Tablero «Equipo Diseño» creado' });
    const link = `${window.location.origin}${window.location.pathname}#k=${CODE_1}`;
    expect(within(dialog).getByLabelText('Enlace del tablero')).toHaveValue(link);
    expect(within(dialog).getByText('Guarda este enlace: no se volverá a mostrar.')).toBeVisible();
    await expectNoAxeViolations(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Copiar enlace' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Enlace copiado'));

    await user.click(within(dialog).getByRole('button', { name: 'Abrir tablero' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Equipo Diseño' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getAccessCode()).toBe(CODE_1);
    expect(window.location.hash).toBe(`#k=${CODE_1}`);
    await waitFor(() => expect(document.title).toBe('«Equipo Diseño» · TaskFlow'));
    expect(await screen.findByRole('region', { name: 'Tablero de tareas' })).toBeVisible();
  });

  it('al cerrar el aviso sin copiar ni abrir pide confirmación (FR-103a)', async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });
    await user.type(nameField(), 'Equipo');
    await user.click(createButton());
    const dialog = await screen.findByRole('dialog', { name: 'Tablero «Equipo» creado' });

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(within(dialog).getByText('No podrás volver a ver este enlace. ¿Cerrar de todos modos?')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(within(dialog).getByLabelText('Enlace del tablero')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar de todos modos' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(getAccessCode()).toBeNull();
    expect(createButton()).toBeVisible();
  });

  it('tras copiar el enlace, el aviso se cierra sin preguntar', async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });
    await user.type(nameField(), 'Equipo');
    await user.click(createButton());
    const dialog = await screen.findByRole('dialog', { name: 'Tablero «Equipo» creado' });

    await user.click(within(dialog).getByRole('button', { name: 'Copiar enlace' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('un error de red ofrece reintentar con el mismo id y conserva el nombre', async () => {
    const user = userEvent.setup();
    const server = renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });
    await user.type(nameField(), 'Equipo');
    server.failNextWithNetworkError();
    await user.click(createButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar. Revisa tu conexión.');
    expect(nameField()).toHaveValue('Equipo');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('dialog', { name: 'Tablero «Equipo» creado' })).toBeVisible();
    const [first, second] = server.requests('POST').map((r) => r.body.id);
    expect(second).toBe(first);
  });

  it('si el tablero ya se creó en un intento anterior, avisa de que no se puede mostrar su enlace (FR-104)', async () => {
    const user = userEvent.setup();
    const server = renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });
    await user.type(nameField(), 'Equipo');
    server.failNextWithNetworkError();
    await user.click(createButton());
    await screen.findByRole('alert');
    // La primera petición llegó al servidor, pero su respuesta se perdió.
    server.markBoardCreated(String(server.requests('POST')[0]!.body.id), 'Equipo');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('El tablero se creó, pero no se pudo mostrar su enlace. Crea otro tablero.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(createButton());
    expect(await screen.findByRole('dialog', { name: 'Tablero «Equipo» creado' })).toBeVisible();
    const ids = server.requests('POST').map((r) => r.body.id);
    expect(ids[2]).not.toBe(ids[1]);
  });

  it.each([
    [403, 'BOARD_CREATION_DISABLED', 'En esta instalación no se pueden crear tableros desde la web.'],
    [429, 'BOARD_CREATION_LIMITED', 'Has creado demasiados tableros. Inténtalo más tarde.'],
  ])('muestra el mensaje de %i %s', async (status, code, message) => {
    const user = userEvent.setup();
    const server = renderHome();
    await screen.findByRole('button', { name: 'Crear tablero' });
    await user.type(nameField(), 'Equipo');
    server.failNextWith(status, code);
    await user.click(createButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
