import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { TASK_STATUSES, type TaskDto, type TaskStatusDto } from '@taskflow/contracts';
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { es, STATUS_LABELS } from '../../i18n/es';
import { useAnnounce } from '../../ui/LiveRegion';
import { MoveContext, type KeyboardMove, type MoveContextValue } from './MoveContext';
import { useMoveTask } from './useMoveTask';

const statusLabel = (id: unknown): string =>
  typeof id === 'string' && id in STATUS_LABELS ? STATUS_LABELS[id as TaskStatusDto] : '';

const originLabel = (active: { data: { current?: Record<string, unknown> | undefined } }): string =>
  statusLabel((active.data.current?.task as TaskDto | undefined)?.status);

// Anuncios en español para el arrastre con puntero (el teclado usa su propio modo).
export const dragAnnouncements: Announcements = {
  onDragStart: ({ active }) => es.move.pickedUp(originLabel(active)),
  onDragOver: ({ over }) => (over ? es.move.over(statusLabel(over.id)) : undefined),
  onDragEnd: ({ over }) => (over ? es.move.dropped(statusLabel(over.id)) : es.move.cancelled),
  onDragCancel: () => es.move.cancelled,
};

interface BoardDndProps {
  readonly enabled: boolean;
  readonly children: ReactNode;
}

/**
 * Arrastrar y soltar (FR-019a): ratón y táctil con dnd-kit (activación tras 5 px o 250 ms de
 * pulsación), y un modo de teclado propio que salta de columna en columna con anuncios.
 * Al soltar se usa la misma mutación pesimista que el selector de estado.
 */
export const BoardDnd = ({ enabled, children }: BoardDndProps) => {
  const move = useMoveTask();
  const announce = useAnnounce();
  const instructionsId = useId();
  const [keyboardMove, setKeyboardMove] = useState<KeyboardMove | null>(null);
  const [dragged, setDragged] = useState<TaskDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragged((active.data.current?.task as TaskDto | undefined) ?? null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    const task = active.data.current?.task as TaskDto | undefined;
    if (task && over && typeof over.id === 'string') move(task, over.id as TaskStatusDto);
  };

  const startKeyboardMove = useCallback(
    (task: TaskDto) => {
      setKeyboardMove({ taskId: task.id, target: task.status });
      announce(es.move.pickedUp(STATUS_LABELS[task.status]));
    },
    [announce],
  );

  const shiftKeyboardTarget = useCallback(
    (delta: -1 | 1) => {
      setKeyboardMove((current) => {
        if (!current) return current;
        const index = TASK_STATUSES.indexOf(current.target);
        const next = TASK_STATUSES[Math.min(Math.max(index + delta, 0), TASK_STATUSES.length - 1)]!;
        announce(es.move.over(STATUS_LABELS[next]));
        return { ...current, target: next };
      });
    },
    [announce],
  );

  const dropKeyboardMove = useCallback(
    (task: TaskDto) => {
      setKeyboardMove((current) => {
        if (!current) return current;
        if (current.target === task.status) {
          announce(es.move.droppedUnchanged);
        } else {
          announce(es.move.dropped(STATUS_LABELS[current.target]));
          move(task, current.target);
        }
        return null;
      });
    },
    [announce, move],
  );

  const cancelKeyboardMove = useCallback(() => {
    setKeyboardMove((current) => {
      if (current) announce(es.move.cancelled);
      return null;
    });
  }, [announce]);

  const value = useMemo<MoveContextValue>(
    () => ({
      dragEnabled: enabled,
      keyboardMove,
      instructionsId,
      move,
      startKeyboardMove,
      shiftKeyboardTarget,
      dropKeyboardMove,
      cancelKeyboardMove,
    }),
    [enabled, keyboardMove, instructionsId, move, startKeyboardMove, shiftKeyboardTarget, dropKeyboardMove, cancelKeyboardMove],
  );

  return (
    <MoveContext.Provider value={value}>
      <DndContext
        sensors={enabled ? sensors : []}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragged(null)}
        accessibility={{ announcements: dragAnnouncements, screenReaderInstructions: { draggable: es.move.instructions } }}
      >
        {children}
        <DragOverlay>
          {dragged ? <div className="card card--overlay">{dragged.title}</div> : null}
        </DragOverlay>
      </DndContext>
      <p id={instructionsId} hidden>
        {es.move.instructions}
      </p>
    </MoveContext.Provider>
  );
};
