import { useDraggable } from '@dnd-kit/core';
import type { TaskDto } from '@taskflow/contracts';
import type { KeyboardEvent } from 'react';
import { useIsTaskSaving } from '../../api/tasks';
import { es } from '../../i18n/es';
import { useMoveContext } from '../board/MoveContext';
import { StatusSelect } from './StatusSelect';

const PersonIcon = () => (
  <svg className="card__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.5 14c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const GripIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    {[4, 8, 12].flatMap((y) => [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />))}
  </svg>
);

interface TaskCardProps {
  readonly task: TaskDto;
  readonly onOpen: (task: TaskDto) => void;
}

/**
 * Tarjeta: título (abre el detalle), responsable o "Sin asignar" con icono y texto (FR-002),
 * selector de estado y, con las tres columnas visibles, asa para moverla (FR-019a).
 */
export const TaskCard = ({ task, onOpen }: TaskCardProps) => {
  const saving = useIsTaskSaving(task.id);
  const moveCtx = useMoveContext();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !moveCtx.dragEnabled || saving,
  });
  const picked = moveCtx.keyboardMove?.taskId === task.id;

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (!picked) {
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        moveCtx.startKeyboardMove(task);
      }
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      event.preventDefault();
      moveCtx.shiftKeyboardTarget(key === 'ArrowRight' ? 1 : -1);
    } else if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      moveCtx.dropKeyboardMove(task);
    } else if (key === 'Escape') {
      event.preventDefault();
      moveCtx.cancelKeyboardMove();
    }
  };

  return (
    <article
      ref={setNodeRef}
      className={['card', isDragging && 'card--dragging', picked && 'card--picked'].filter(Boolean).join(' ')}
      aria-busy={saving || undefined}
      {...(moveCtx.dragEnabled ? listeners : {})}
    >
      <div className="card__top">
        <button type="button" className="card__title" onClick={() => onOpen(task)}>
          {task.title}
        </button>
        {moveCtx.dragEnabled && (
          <button
            type="button"
            className="card__handle"
            aria-label={es.move.handle(task.title)}
            aria-pressed={picked}
            aria-describedby={moveCtx.instructionsId}
            disabled={saving}
            onKeyDown={onHandleKeyDown}
            onBlur={() => picked && moveCtx.cancelKeyboardMove()}
          >
            <GripIcon />
          </button>
        )}
      </div>
      <p className={task.assignee ? 'card__assignee' : 'card__assignee card__assignee--none'}>
        <PersonIcon />
        <span>{task.assignee ? task.assignee.name : es.unassigned}</span>
      </p>
      <StatusSelect task={task} saving={saving} />
      {saving && <p className="card__saving">{es.saving}</p>}
    </article>
  );
};
