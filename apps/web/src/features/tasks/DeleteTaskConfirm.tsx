import type { TaskDto } from '@taskflow/contracts';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { useDeleteTask } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { ErrorAlert } from '../../ui/ErrorAlert';

interface DeleteTaskConfirmProps {
  readonly task: TaskDto;
  readonly onCancel: () => void;
  readonly onDeleted: (task: TaskDto) => void;
}

/** Confirmación explícita con el título de la tarea antes de borrar (FR-013a). */
export const DeleteTaskConfirm = ({ task, onCancel, onDeleted }: DeleteTaskConfirmProps) => {
  const remove = useDeleteTask();
  const [failure, setFailure] = useState<string | null>(null);

  const confirm = () => {
    setFailure(null);
    remove.mutate(task.id, {
      onSuccess: () => onDeleted(task),
      onError: (error) => setFailure(errorMessage(error instanceof ApiError ? error.code : 'INTERNAL_ERROR')),
    });
  };

  return (
    <div className="task-detail__confirm" role="group" aria-label={es.remove.confirm(task.title)}>
      <p className="task-detail__warning">{es.remove.confirm(task.title)}</p>
      {failure && <ErrorAlert message={failure} onRetry={confirm} retryDisabled={remove.isPending} />}
      <div className="task-detail__actions">
        <Button variant="danger" onClick={confirm} disabled={remove.isPending}>
          {remove.isPending ? es.saving : es.remove.confirmButton}
        </Button>
        <Button onClick={onCancel} disabled={remove.isPending}>
          {es.remove.cancel}
        </Button>
      </div>
    </div>
  );
};
