import { TASK_STATUSES, type TaskDto, type TaskStatusDto } from '@taskflow/contracts';
import { useId } from 'react';
import { es, STATUS_LABELS } from '../../i18n/es';
import { useMoveContext } from '../board/MoveContext';

interface StatusSelectProps {
  readonly task: TaskDto;
  readonly saving: boolean;
}

/** Control explícito de estado, operable con teclado, ratón y táctil (FR-019). */
export const StatusSelect = ({ task, saving }: StatusSelectProps) => {
  const id = useId();
  const { move } = useMoveContext();
  return (
    <div className="card__status">
      <label htmlFor={id} className="card__status-label">
        {es.move.statusLabel}{' '}
        <span className="visually-hidden">{es.move.statusOf(task.title)}</span>
      </label>
      <select
        id={id}
        className="card__select"
        value={task.status}
        disabled={saving}
        onChange={(e) => move(task, e.target.value as TaskStatusDto)}
      >
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
};
