import { TASK_STATUSES, type TaskDto } from '@taskflow/contracts';
import { useMemo } from 'react';
import { es } from '../../i18n/es';
import { BoardTabs } from './BoardTabs';
import { Column } from './Column';
import { useIsWideLayout } from './useIsWideLayout';
import './board.css';

interface BoardProps {
  readonly tasks: readonly TaskDto[];
  readonly onOpenTask: (task: TaskDto) => void;
}

/** Tres columnas fijas en orden (FR-001); en móvil, pestañas (FR-032). */
export const Board = ({ tasks, onOpenTask }: BoardProps) => {
  const wide = useIsWideLayout();
  const columns = useMemo(
    () => TASK_STATUSES.map((status) => ({ status, tasks: tasks.filter((t) => t.status === status) })),
    [tasks],
  );

  return (
    <section className="board" aria-labelledby="board-heading">
      <h2 id="board-heading" className="visually-hidden">
        {es.board.label}
      </h2>
      {wide ? (
        <div className="board__columns">
          {columns.map(({ status, tasks: columnTasks }) => (
            <Column key={status} status={status} tasks={columnTasks} onOpenTask={onOpenTask} />
          ))}
        </div>
      ) : (
        <BoardTabs columns={columns} onOpenTask={onOpenTask} />
      )}
    </section>
  );
};
