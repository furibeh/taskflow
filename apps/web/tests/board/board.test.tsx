import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { setViewportWide } from '../setup';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });

describe('tablero y creación de tareas (US1)', () => {
  it('tablero vacío: tres columnas en orden con contador 0 y mensaje orientativo', async () => {
    const { container } = renderApp();

    await screen.findByText(/Todavía no hay tareas/);
    const board = screen.getByRole('region', { name: 'Tablero de tareas' });
    const headings = within(board).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringMatching(/^Pendiente/),
      expect.stringMatching(/^En progreso/),
      expect.stringMatching(/^Hecha/),
    ]);
    for (const name of ['Pendiente', 'En progreso', 'Hecha']) {
      expect(within(column(name)).getByText('0 tareas')).toBeInTheDocument();
      expect(within(column(name)).getByText('No hay tareas en esta columna.')).toBeInTheDocument();
    }
    await expectNoAxeViolations(container);
  });

  it('un título vacío muestra el error junto al campo y no envía nada', async () => {
    const user = userEvent.setup();
    const { server } = renderApp();
    await screen.findByText(/Todavía no hay tareas/);

    await user.type(screen.getByLabelText('Título'), '   ');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));

    const title = screen.getByLabelText('Título');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(expect.stringContaining('El título es obligatorio.'));
    expect(server.postBodies()).toHaveLength(0);
  });

  it('no deja escribir más de 200 caracteres y muestra el contador', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText(/Todavía no hay tareas/);
    const title = screen.getByLabelText('Título');

    await user.click(title);
    await user.paste('a'.repeat(205));

    expect(title).toHaveValue('a'.repeat(200));
    expect(screen.getByText('200/200')).toBeInTheDocument();
  });

  it('crea una tarea: "Guardando…" mientras espera, después aparece en Pendiente y se vacía el formulario', async () => {
    const user = userEvent.setup();
    const { server, container } = renderApp();
    await screen.findByText(/Todavía no hay tareas/);

    await user.type(screen.getByLabelText('Título'), 'Preparar demo');
    await user.type(screen.getByLabelText('Descripción (opcional)'), 'Slides y datos');
    const release = server.holdWrites();
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));

    const saving = await screen.findByRole('button', { name: 'Guardando…' });
    expect(saving).toBeDisabled();
    expect(within(column('Pendiente')).queryByText('Preparar demo')).not.toBeInTheDocument();

    release();
    await waitFor(() =>
      expect(within(column('Pendiente')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument(),
    );
    expect(within(column('Pendiente')).getByText('1 tarea')).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('');
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('');
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea creada'));
    await expectNoAxeViolations(container);
  });

  it('si falla el guardado conserva lo escrito y "Reintentar" reutiliza el mismo id', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    renderApp(server);
    await screen.findByText(/Todavía no hay tareas/);

    await user.type(screen.getByLabelText('Título'), 'Preparar demo');
    server.failNextWithNetworkError();
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo guardar. Revisa tu conexión.');
    expect(screen.getByLabelText('Título')).toHaveValue('Preparar demo');
    expect(server.tasks).toHaveLength(0);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(server.tasks).toHaveLength(1));
    const [first, second] = server.postBodies();
    expect(second?.id).toBe(first?.id);
  });

  it('muestra el texto de usuario como texto literal', async () => {
    const server = createFakeServer();
    server.addTask({ title: '<img src=x onerror=alert(1)>' });
    const { container } = renderApp(server);

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('abre el detalle con título, descripción, estado, responsable y fecha de creación', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo', description: 'Slides\ny datos', status: 'in_progress' });
    renderApp(server);

    await user.click(await screen.findByRole('button', { name: 'Preparar demo' }));

    const dialog = await screen.findByRole('dialog', { name: 'Preparar demo' });
    expect(within(dialog).getByText(/Slides/)).toBeInTheDocument();
    expect(within(dialog).getByText('En progreso')).toBeInTheDocument();
    expect(within(dialog).getByText('Sin asignar')).toBeInTheDocument();
    expect(within(dialog).getByText(/17 de octubre de 2026/)).toBeInTheDocument();
  });

  it('en pantallas estrechas muestra las columnas como pestañas con contador', async () => {
    setViewportWide(false);
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Hecha ya', status: 'done' });
    try {
      renderApp(server);
      const tabs = await screen.findAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual([
        expect.stringMatching(/^Pendiente.*0/),
        expect.stringMatching(/^En progreso.*0/),
        expect.stringMatching(/^Hecha.*1/),
      ]);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await user.click(tabs[0]!);
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('tab', { name: /^Hecha/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Hecha ya');
    } finally {
      setViewportWide(true);
    }
  });
});
