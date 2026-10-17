import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const openPeople = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Personas' }));
  return screen.findByRole('dialog', { name: 'Personas del equipo' });
};

describe('gestión de personas (US6)', () => {
  it('añade personas y las muestra en la lista', async () => {
    const user = userEvent.setup();
    const { server } = renderApp();
    const dialog = await openPeople(user);

    expect(within(dialog).getByText(/Todavía no hay personas/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nombre'), 'Ana');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }));

    expect(await within(dialog).findByText('Ana')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('');
    expect(server.people.map((p) => p.name)).toEqual(['Ana']);
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Ana añadida al equipo'));
    await expectNoAxeViolations(dialog);
  });

  it('valida el nombre: obligatorio, máximo 50 y sin repetir', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addPerson('Ana');
    renderApp(server);
    const dialog = await openPeople(user);
    const name = within(dialog).getByLabelText('Nombre');

    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    expect(name).toHaveAccessibleDescription(expect.stringContaining('El nombre es obligatorio.'));

    await user.click(name);
    await user.paste('x'.repeat(60));
    expect(name).toHaveValue('x'.repeat(50));

    await user.clear(name);
    await user.type(name, 'ana');
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }));
    expect(
      await within(dialog).findByText('Ya existe una persona con ese nombre.'),
    ).toBeInTheDocument();
    expect(name).toHaveValue('ana');
  });

  it('quitar pide confirmación con el número de tareas; cancelar la conserva', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const luis = server.addPerson('Luis');
    for (const n of [1, 2, 3]) server.addTask({ title: `Tarea ${n}`, assignee: { id: luis, name: 'Luis' } });
    renderApp(server);
    const dialog = await openPeople(user);

    await user.click(await within(dialog).findByRole('button', { name: 'Quitar a Luis' }));
    expect(within(dialog).getByText('Se quitará a Luis. 3 tareas quedarán sin asignar.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(within(dialog).getByText('Luis')).toBeInTheDocument();
    expect(server.people).toHaveLength(1);
  });

  it('al confirmar, la persona desaparece y sus tareas quedan "Sin asignar"', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const luis = server.addPerson('Luis');
    server.addTask({ title: 'Preparar demo', assignee: { id: luis, name: 'Luis' } });
    renderApp(server);
    expect(await screen.findByRole('article')).toHaveTextContent('Luis');
    const dialog = await openPeople(user);

    await user.click(await within(dialog).findByRole('button', { name: 'Quitar a Luis' }));
    expect(within(dialog).getByText('Se quitará a Luis. 1 tarea quedará sin asignar.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(within(dialog).queryByText('Luis')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Luis quitado del equipo'));
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveTextContent('Sin asignar'),
    );
  });
});

describe('la persona ya no existe (T144)', () => {
  it('al quitarla: avisa y recarga personas y tareas', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const luis = server.addPerson('Luis');
    server.addTask({ title: 'Preparar demo', assignee: { id: luis, name: 'Luis' } });
    renderApp(server);
    const dialog = await openPeople(user);

    await user.click(await within(dialog).findByRole('button', { name: 'Quitar a Luis' }));
    // Otra persona la quita antes de confirmar (y sus tareas quedan sin asignar).
    server.people.splice(0, 1);
    server.tasks[0]!.assignee = null;
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Esta persona ya no está en el equipo.');
    await waitFor(() => expect(within(dialog).queryByText('Luis')).not.toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('article')).toHaveTextContent('Sin asignar'));
  });
});
