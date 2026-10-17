import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const openDetail = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(await screen.findByRole('button', { name: title }));
  return screen.findByRole('dialog', { name: title });
};

describe('editar, borrar y deshacer (US5)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('edita título y descripción; cancelar no guarda nada', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo', description: 'Slides', status: 'in_progress' });
    renderApp(server);

    let dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Editar' }));
    await user.clear(within(dialog).getByLabelText('Título'));
    await user.type(within(dialog).getByLabelText('Título'), 'Otra cosa');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(server.requests('PATCH')).toHaveLength(0);
    expect(within(dialog).getByRole('heading', { name: 'Preparar demo' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Editar' }));
    const title = within(dialog).getByLabelText('Título');
    await user.clear(title);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(title).toHaveAccessibleDescription(expect.stringContaining('El título es obligatorio.'));
    expect(server.requests('PATCH')).toHaveLength(0);

    await user.type(title, 'Demo final');
    await user.clear(within(dialog).getByLabelText('Descripción'));
    await user.type(within(dialog).getByLabelText('Descripción'), 'Con datos');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    dialog = await screen.findByRole('dialog', { name: 'Demo final' });
    expect(within(dialog).getByText('Con datos')).toBeInTheDocument();
    expect(server.requests('PATCH')[0]?.body).toEqual({ title: 'Demo final', description: 'Con datos' });
    expect(server.tasks[0]).toMatchObject({ status: 'in_progress' });
    await expectNoAxeViolations(dialog);
  });

  it('borrar pide confirmación con el título; cancelar la conserva', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    expect(within(dialog).getByText('¿Borrar la tarea «Preparar demo»?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(server.requests('DELETE')).toHaveLength(0);
    expect(server.tasks).toHaveLength(1);
  });

  it('tras borrar ofrece "Deshacer", que restaura la tarea', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    const { container } = renderApp(server);

    const dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Borrar tarea' }));

    expect((await screen.findByText('Tarea borrada')).closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByRole('button', { name: 'Preparar demo' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea restaurada'));
    expect(screen.queryByText('Tarea borrada')).not.toBeInTheDocument();
  });

  it('a los 10 s el aviso desaparece y el borrado queda definitivo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Borrar tarea' }));
    expect(await screen.findByText('Tarea borrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).not.toHaveFocus();

    await act(async () => {
      vi.advanceTimersByTime(10_100);
    });
    await waitFor(() => expect(screen.queryByText('Tarea borrada')).not.toBeInTheDocument());
    expect(server.requests('POST').filter((r) => r.url.endsWith('/restore'))).toHaveLength(0);
  });

  it('si tiene el foco a los 10 s, sigue visible pero "Deshacer" se desactiva y se anuncia', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Borrar tarea' }));
    const undo = await screen.findByRole('button', { name: 'Deshacer' });
    act(() => undo.focus());

    await act(async () => {
      vi.advanceTimersByTime(10_100);
    });
    expect(screen.getByText('Tarea borrada')).toBeInTheDocument();
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    await user.click(undo);
    expect(server.requests('POST').filter((r) => r.url.endsWith('/restore'))).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Ya no se puede deshacer'));

    act(() => undo.blur());
    await waitFor(() => expect(screen.queryByText('Tarea borrada')).not.toBeInTheDocument());
  });

  it('si el servidor ya no permite deshacer, lo explica', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const dialog = await openDetail(user, 'Preparar demo');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    await user.click(within(dialog).getByRole('button', { name: 'Borrar tarea' }));
    server.expireRestores();
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no se puede deshacer.');
  });
});

describe('borrado con el teclado', () => {
  it('confirmar con Enter lleva el foco a "Deshacer"', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    await user.click(await screen.findByRole('button', { name: 'Preparar demo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Preparar demo' });
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));
    within(dialog).getByRole('button', { name: 'Borrar tarea' }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Deshacer' })).toHaveFocus());
  });
});
