import type { TaskDto } from '@taskflow/contracts';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { STATUS_LABELS, type TaskStatus } from '../../i18n/es';
import { ColumnTasks } from './Column';

interface BoardTabsProps {
  readonly columns: ReadonlyArray<{ status: TaskStatus; tasks: readonly TaskDto[] }>;
  readonly onOpenTask: (task: TaskDto) => void;
}

/** Columnas como pestañas accesibles en pantallas estrechas (< 768 px). */
export const BoardTabs = ({ columns, onOpenTask }: BoardTabsProps) => {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const select = (index: number) => {
    const next = (index + columns.length) % columns.length;
    setSelected(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: columns.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  const current = columns[selected];

  return (
    <div className="board-tabs">
      <div role="tablist" aria-label="Columnas" className="board-tabs__list">
        {columns.map(({ status, tasks }, index) => (
          <button
            key={status}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${status}`}
            aria-selected={index === selected}
            aria-controls={`${baseId}-panel`}
            tabIndex={index === selected ? 0 : -1}
            className={`board-tabs__tab board-tabs__tab--${status}`}
            onClick={() => setSelected(index)}
            onKeyDown={onKeyDown}
          >
            {STATUS_LABELS[status]} <span className="board-tabs__count">({tasks.length})</span>
          </button>
        ))}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${current.status}`}
          className={`column column--tab column--${current.status}`}
        >
          <ColumnTasks tasks={current.tasks} onOpenTask={onOpenTask} />
        </div>
      )}
    </div>
  );
};
