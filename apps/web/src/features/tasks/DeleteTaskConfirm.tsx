import type { TaskDto } from '@taskflow/contracts';
import { useState, type MouseEvent } from 'react';
import { ApiError } from '../../api/client';
import { useDeleteTask } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { ErrorAlert } from '../../ui/ErrorAlert';

interface DeleteTaskConfirmProps {
  readonly task: TaskDto;
  readonly onCancel: () => void;
  /** viaKeyboard: la confirmación se hizo con el teclado (para decidir adónde va el foco). */
  readonly onDeleted: (task: TaskDto, viaKeyboard: boolean) => void;
  /** La tarea ya no existe (borrada por otra persona): no tiene sentido reintentar. */
  readonly onGone: () => void;
}

/** Confirmación explícita con el título de la tarea antes de borrar (FR-013a). */
export const DeleteTaskConfirm = ({ task, onCancel, onDeleted, onGone }: DeleteTaskConfirmProps) => {
  const remove = useDeleteTask();
  const [failure, setFailure] = useState<string | null>(null);

  const confirm = (event?: MouseEvent) => {
    // Un "click" generado con Enter o Espacio tiene detail === 0.
    const viaKeyboard = event?.detail === 0;
    setFailure(null);
    remove.mutate(task.id, {
      onSuccess: () => onDeleted(task, viaKeyboard),
      onError: (error) => {
        const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
        if (code === 'TASK_NOT_FOUND') return onGone();
        setFailure(errorMessage(code));
      },
    });
  };

  return (
    <div className="task-detail__confirm" role="group" aria-label={es.remove.confirm(task.title)}>
      <p className="task-detail__warning">{es.remove.confirm(task.title)}</p>
      {failure && <ErrorAlert message={failure} onRetry={() => confirm()} retryDisabled={remove.isPending} />}
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
