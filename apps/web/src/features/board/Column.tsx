import { useDroppable } from '@dnd-kit/core';
import type { TaskDto } from '@taskflow/contracts';
import { useId } from 'react';
import { es, STATUS_LABELS, type TaskStatus } from '../../i18n/es';
import { TaskCard } from '../tasks/TaskCard';
import { useMoveContext } from './MoveContext';

interface ColumnProps {
  readonly status: TaskStatus;
  readonly tasks: readonly TaskDto[];
  readonly onOpenTask: (task: TaskDto) => void;
}

export const ColumnTasks = ({ tasks, onOpenTask }: Omit<ColumnProps, 'status'>) =>
  tasks.length === 0 ? (
    <p className="column__empty">{es.board.emptyColumn}</p>
  ) : (
    <ul className="column__list">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} onOpen={onOpenTask} />
        </li>
      ))}
    </ul>
  );

/** Columna del tablero con su número de tareas visibles (FR-003). */
export const Column = ({ status, tasks, onOpenTask }: ColumnProps) => {
  const headingId = useId();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { keyboardMove } = useMoveContext();
  const dropTarget = isOver || keyboardMove?.target === status;
  return (
    <section
      ref={setNodeRef}
      className={dropTarget ? 'column column--drop-target' : 'column'}
      aria-labelledby={headingId}
      data-drop-target={dropTarget || undefined}
    >
      <header className="column__header">
        <h3 id={headingId} className="column__title">
          {STATUS_LABELS[status]}
        </h3>
        <p className="column__count">{es.board.columnCount(tasks.length)}</p>
      </header>
      <ColumnTasks tasks={tasks} onOpenTask={onOpenTask} />
    </section>
  );
};
