import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

describe('asignación (US3)', () => {
  it('al crear, el selector ofrece "Sin asignar" y las personas, y crea la tarea asignada', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const ana = server.addPerson('Ana');
    server.addPerson('Luis');
    renderApp(server);

    const select = await screen.findByRole('combobox', { name: 'Responsable (opcional)' });
    await waitFor(() =>
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin asignar', 'Ana', 'Luis']),
    );

    await user.type(screen.getByLabelText('Título'), 'Preparar demo');
    await user.selectOptions(select, ana);
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));

    const card = await screen.findByRole('article');
    expect(card).toHaveTextContent('Ana');
    expect(server.postBodies()[0]).toMatchObject({ assigneeId: ana });
    expect(select).toHaveValue('');
  });

  it('sin personas solo ofrece "Sin asignar" y explica cómo añadirlas', async () => {
    renderApp();
    const select = await screen.findByRole('combobox', { name: 'Responsable (opcional)' });
    await waitFor(() => expect(select).toHaveAccessibleDescription('Añade personas desde «Personas».'));
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin asignar']);
  });

  it('la tarjeta sin responsable muestra "Sin asignar" con icono y texto', async () => {
    const server = createFakeServer();
    server.addTask({ title: 'Sin dueño' });
    const { container } = renderApp(server);
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Sin asignar')).toBeInTheDocument();
    expect(card.querySelector('.card__assignee svg')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('desde el detalle se reasigna y se quita la asignación', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const ana = server.addPerson('Ana');
    const luis = server.addPerson('Luis');
    server.addTask({ title: 'Preparar demo', assignee: { id: ana, name: 'Ana' } });
    renderApp(server);

    await user.click(await screen.findByRole('button', { name: 'Preparar demo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Preparar demo' });
    const select = within(dialog).getByRole('combobox', { name: 'Responsable' });
    await waitFor(() => expect(select).toHaveValue(ana));

    await user.selectOptions(select, luis);
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea asignada a Luis'));
    expect(server.tasks[0]?.assignee).toEqual({ id: luis, name: 'Luis' });

    await user.selectOptions(select, '');
    await waitFor(() => expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea sin asignar'));
    expect(server.tasks[0]?.assignee).toBeNull();
    expect(server.requests('PATCH').map((r) => r.body)).toEqual([{ assigneeId: luis }, { assigneeId: null }]);
  });

  it('si la persona ya no existe, avisa sin cambiar la tarea', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    const ana = server.addPerson('Ana');
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    await user.click(await screen.findByRole('button', { name: 'Preparar demo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Preparar demo' });
    const select = within(dialog).getByRole('combobox', { name: 'Responsable' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    server.people.splice(0, 1);
    await user.selectOptions(select, ana);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La persona elegida ya no está en el equipo.');
    expect(server.tasks[0]?.assignee).toBeNull();
  });
});
