import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const cards = () => screen.queryAllByRole('article').map((a) => within(a).getAllByRole('button')[0]!.textContent);

const seeded = () => {
  const server = createFakeServer();
  const ana = server.addPerson('Ana');
  server.addTask({ title: 'Revisión de Diseño', assignee: { id: ana, name: 'Ana' }, status: 'in_progress' });
  server.addTask({ title: 'Factura de octubre', assignee: { id: ana, name: 'Ana' } });
  server.addTask({ title: 'Comprar café', status: 'done' });
  return { server, ana };
};

describe('búsqueda y filtros (US4)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('busca sin tildes y combina con el filtro de responsable', async () => {
    const user = userEvent.setup();
    const { server, ana } = seeded();
    const { container } = renderApp(server);
    await screen.findByText('Comprar café');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'revision');
    await waitFor(() => expect(cards()).toEqual(['Revisión de Diseño']));

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar tareas' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por responsable' }), ana);
    await waitFor(() => expect(cards().sort()).toEqual(['Factura de octubre', 'Revisión de Diseño']));

    await user.click(screen.getByRole('checkbox', { name: 'En progreso' }));
    await waitFor(() => expect(cards()).toEqual(['Factura de octubre']));
    await expectNoAxeViolations(container);
  });

  it('filtra las tareas sin asignar', async () => {
    const user = userEvent.setup();
    renderApp(seeded().server);
    await screen.findByText('Comprar café');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por responsable' }), 'unassigned');
    await waitFor(() => expect(cards()).toEqual(['Comprar café']));
  });

  it('sin coincidencias en la búsqueda: mensaje con el texto y "Limpiar búsqueda y filtros"', async () => {
    const user = userEvent.setup();
    renderApp(seeded().server);
    await screen.findByText('Comprar café');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'zzz');
    expect(await screen.findByText('No hay tareas que coincidan con «zzz»')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('live-region')).toHaveTextContent('No hay tareas que coincidan con «zzz»'),
    );

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda y filtros' }));
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(screen.getByRole('searchbox', { name: 'Buscar tareas' })).toHaveValue('');
  });

  it('sin coincidencias solo por filtros: mensaje de filtros; siempre queda al menos un estado', async () => {
    const user = userEvent.setup();
    const { server, ana } = seeded();
    renderApp(server);
    await screen.findByText('Comprar café');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por responsable' }), ana);
    await user.click(screen.getByRole('checkbox', { name: 'Pendiente' }));
    await user.click(screen.getByRole('checkbox', { name: 'En progreso' }));

    expect(await screen.findByText('No hay tareas que coincidan con los filtros')).toBeInTheDocument();
    const done = screen.getByRole('checkbox', { name: 'Hecha' });
    expect(done).toBeChecked();
    expect(done).toBeDisabled();
  });

  it('muestra los filtros activos y los conserva al recargar', async () => {
    const user = userEvent.setup();
    const { server } = seeded();
    const first = renderApp(server);
    await screen.findByText('Comprar café');
    await user.click(screen.getByRole('checkbox', { name: 'Hecha' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'factura');
    await waitFor(() => expect(screen.getByText(/Filtros activos/)).toHaveTextContent('«factura»'));
    first.unmount();

    renderApp(server);
    expect(await screen.findByRole('searchbox', { name: 'Buscar tareas' })).toHaveValue('factura');
    expect(screen.getByRole('checkbox', { name: 'Hecha' })).not.toBeChecked();
    await waitFor(() => expect(cards()).toEqual(['Factura de octubre']));
  });

  it('funciona aunque localStorage falle', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const user = userEvent.setup();
    renderApp(seeded().server);
    await screen.findByText('Comprar café');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'café');
    await waitFor(() => expect(cards()).toEqual(['Comprar café']));
  });

  it('avisa si la tarea creada no se ve por los filtros activos', async () => {
    const user = userEvent.setup();
    renderApp(seeded().server);
    await screen.findByText('Comprar café');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar tareas' }), 'factura');
    await waitFor(() => expect(cards()).toEqual(['Factura de octubre']));

    await user.type(screen.getByLabelText('Título'), 'Llamar al proveedor');
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(
      await screen.findByText('La tarea se ha creado, pero no se muestra por los filtros activos.'),
    ).toBeInTheDocument();
  });

  it('si se quita a la persona filtrada, el filtro vuelve a "Todos" (US4 escenario 11)', async () => {
    const user = userEvent.setup();
    const { server, ana } = seeded();
    renderApp(server);
    await screen.findByText('Comprar café');
    const filter = screen.getByRole('combobox', { name: 'Filtrar por responsable' });
    await user.selectOptions(filter, ana);

    await user.click(screen.getByRole('button', { name: 'Personas' }));
    const dialog = await screen.findByRole('dialog', { name: 'Personas del equipo' });
    await user.click(within(dialog).getByRole('button', { name: 'Quitar a Ana' }));
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(filter).toHaveValue('all'));
    await act(async () => {});
    await waitFor(() => expect(cards()).toHaveLength(3));
  });
});
