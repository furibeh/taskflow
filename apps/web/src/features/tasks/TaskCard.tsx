import type { TaskDto } from '@taskflow/contracts';
import { es } from '../../i18n/es';

const PersonIcon = () => (
  <svg className="card__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.5 14c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

interface TaskCardProps {
  readonly task: TaskDto;
  readonly onOpen: (task: TaskDto) => void;
}

/** Tarjeta: título (abre el detalle) y responsable o "Sin asignar" con icono y texto (FR-002). */
export const TaskCard = ({ task, onOpen }: TaskCardProps) => (
  <article className="card">
    <button type="button" className="card__title" onClick={() => onOpen(task)}>
      {task.title}
    </button>
    <p className={task.assignee ? 'card__assignee' : 'card__assignee card__assignee--none'}>
      <PersonIcon />
      <span>{task.assignee ? task.assignee.name : es.unassigned}</span>
    </p>
  </article>
);
