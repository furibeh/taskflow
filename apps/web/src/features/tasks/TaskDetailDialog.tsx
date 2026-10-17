import type { TaskDto } from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../../api/client';
import { tasksKey, useTask } from '../../api/tasks';
import { errorMessage, es, STATUS_LABELS } from '../../i18n/es';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

interface TaskDetailDialogProps {
  readonly task: TaskDto | null;
  readonly onClose: () => void;
}

/** Detalle completo de una tarea (FR-005). */
export const TaskDetailDialog = ({ task: initial, onClose }: TaskDetailDialogProps) => {
  const query = useTask(initial?.id ?? null, initial ?? undefined);
  const queryClient = useQueryClient();
  const notFound = query.error instanceof ApiError && query.error.code === 'TASK_NOT_FOUND';

  useEffect(() => {
    // La tarea desapareció (borrada por otra persona): se recarga el tablero (FR-013b).
    if (notFound) void queryClient.invalidateQueries({ queryKey: tasksKey });
  }, [notFound, queryClient]);

  const task = query.data ?? initial;

  return (
    <Dialog open={initial !== null} title={task?.title ?? ''} onClose={onClose}>
      {notFound ? (
        <ErrorAlert message={errorMessage('TASK_NOT_FOUND')} />
      ) : (
        task && (
          <div className="task-detail">
            <dl className="task-detail__meta">
              <div>
                <dt>{es.detail.status}</dt>
                <dd>{STATUS_LABELS[task.status]}</dd>
              </div>
              <div>
                <dt>{es.detail.assignee}</dt>
                <dd>{task.assignee ? task.assignee.name : es.unassigned}</dd>
              </div>
              <div>
                <dt>{es.detail.createdAt}</dt>
                <dd>
                  <time dateTime={task.createdAt}>{dateFormat.format(new Date(task.createdAt))}</time>
                </dd>
              </div>
            </dl>
            <h3 className="task-detail__subheading">{es.detail.description}</h3>
            <p className="task-detail__description">{task.description || es.detail.noDescription}</p>
          </div>
        )
      )}
    </Dialog>
  );
};
