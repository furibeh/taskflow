import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../axe';
import { setViewportWide } from '../setup';
import { createFakeServer } from '../support/fake-server';
import { renderApp } from '../support/render-app';

const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });
const live = () => screen.getByTestId('live-region');
const pointer = (clientX: number, clientY: number) => ({ clientX, clientY, button: 0, isPrimary: true });

describe('mover tarjetas arrastrando con el teclado (US2, FR-019a)', () => {
  it('Espacio coge, flechas eligen columna, Espacio suelta; cada paso se anuncia', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    const { container } = renderApp(server);

    const handle = await screen.findByRole('button', { name: 'Mover «Preparar demo»' });
    handle.focus();

    await user.keyboard(' ');
    await waitFor(() => expect(live()).toHaveTextContent('Tarea cogida'));
    expect(handle).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(live()).toHaveTextContent('Sobre En progreso'));
    expect(column('En progreso')).toHaveAttribute('data-drop-target', 'true');

    await user.keyboard(' ');
    await waitFor(() => expect(live()).toHaveTextContent('Tarea soltada en En progreso'));
    await waitFor(() =>
      expect(within(column('En progreso')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument(),
    );
    expect(server.requests('PATCH')).toHaveLength(1);
    expect(server.requests('PATCH')[0]?.body).toEqual({ status: 'in_progress' });
    await expectNoAxeViolations(container);
  });

  it('Escape cancela sin enviar nada', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    (await screen.findByRole('button', { name: 'Mover «Preparar demo»' })).focus();
    await user.keyboard(' {ArrowRight}{ArrowRight}{Escape}');

    await waitFor(() => expect(live()).toHaveTextContent('Movimiento cancelado'));
    expect(server.requests('PATCH')).toHaveLength(0);
    expect(within(column('Pendiente')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument();
  });

  it('soltar en la misma columna no envía nada', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    (await screen.findByRole('button', { name: 'Mover «Preparar demo»' })).focus();
    await user.keyboard(' {ArrowRight}{ArrowLeft} ');

    await waitFor(() => expect(live()).toHaveTextContent('Tarea soltada sin cambios'));
    expect(server.requests('PATCH')).toHaveLength(0);
  });

  it('una tarjeta que se está guardando no se puede mover', async () => {
    const user = userEvent.setup();
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const release = server.holdWrites();
    await user.selectOptions(await screen.findByRole('combobox', { name: /Estado de/ }), 'done');
    expect(await screen.findByRole('button', { name: 'Mover «Preparar demo»' })).toBeDisabled();
    release();
  });

  it('pulsar y mover el puntero sobre la tarjeta inicia el arrastre (control de la prueba siguiente)', async () => {
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const card = (await screen.findByRole('button', { name: 'Preparar demo' })).closest('article')!;
    fireEvent.pointerDown(card.querySelector('.card__assignee')!, pointer(10, 10));
    fireEvent.pointerMove(document, pointer(60, 10));

    await waitFor(() => expect(card).toHaveClass('card--dragging'));
    fireEvent.pointerUp(document, pointer(60, 10));
  });

  it('cambiar el estado con el selector no deja la tarjeta lista para arrastrarse (#11)', async () => {
    const server = createFakeServer();
    server.addTask({ title: 'Preparar demo' });
    renderApp(server);

    const select = await screen.findByRole('combobox', { name: /Estado de/ });
    // El desplegable nativo se queda con el pointerup: solo llega el pointerdown y el change
    // (user.selectOptions simularía también el pointerup y ocultaría el bug).
    fireEvent.pointerDown(select, pointer(10, 10));
    fireEvent.change(select, { target: { value: 'in_progress' } });
    await waitFor(() =>
      expect(within(column('En progreso')).getByRole('button', { name: 'Preparar demo' })).toBeInTheDocument(),
    );

    fireEvent.pointerMove(document, pointer(80, 40));
    const card = screen.getByRole('button', { name: 'Preparar demo' }).closest('article')!;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(card).not.toHaveClass('card--dragging');
  });

  it('por debajo de 768 px no se ofrece arrastrar', async () => {
    setViewportWide(false);
    try {
      const server = createFakeServer();
      server.addTask({ title: 'Preparar demo' });
      renderApp(server);
      await screen.findByRole('combobox', { name: /Estado de/ });
      expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument();
    } finally {
      setViewportWide(true);
    }
  });
});
