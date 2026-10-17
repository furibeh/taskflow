import type { TaskDto } from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { peopleKey } from '../../api/people';
import { tasksKey, useTask, useUpdateTask } from '../../api/tasks';
import { errorMessage, es, STATUS_LABELS } from '../../i18n/es';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { Button } from '../../ui/Button';
import { useAnnounce } from '../../ui/LiveRegion';
import { useOperationFeedback } from '../../ui/OperationFeedback';
import { AssigneeSelect } from './AssigneeSelect';
import { DeleteTaskConfirm } from './DeleteTaskConfirm';
import { EditTaskForm } from './EditTaskForm';

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

interface TaskDetailDialogProps {
  readonly task: TaskDto | null;
  readonly onClose: () => void;
  readonly onDeleted: (task: TaskDto, viaKeyboard: boolean) => void;
}

/** Detalle completo de una tarea (FR-005). */
export const TaskDetailDialog = ({ task: initial, onClose, onDeleted }: TaskDetailDialogProps) => {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const query = useTask(initial?.id ?? null, initial ?? undefined);
  const queryClient = useQueryClient();
  const notFound = query.error instanceof ApiError && query.error.code === 'TASK_NOT_FOUND';

  useEffect(() => {
    // La tarea desapareció (borrada por otra persona): se recarga el tablero (FR-013b).
    if (notFound) void queryClient.invalidateQueries({ queryKey: tasksKey });
  }, [notFound, queryClient]);

  const task = query.data ?? initial;
  const update = useUpdateTask();
  const announce = useAnnounce();
  const [failure, setFailure] = useState<string | null>(null);
  const feedback = useOperationFeedback();

  // Otra persona borró la tarea mientras se editaba o se iba a borrar (FR-013b): se avisa en el
  // tablero, se cierra el detalle y se recarga el tablero.
  const onGone = () => {
    setMode('view');
    feedback.report(errorMessage('TASK_NOT_FOUND'));
    void queryClient.invalidateQueries({ queryKey: tasksKey });
    onClose();
  };

  const assign = (assigneeId: string | null) => {
    if (!task) return;
    setFailure(null);
    update.mutate(
      { id: task.id, patch: { assigneeId } },
      {
        onSuccess: (updated) =>
          announce(updated.assignee ? es.assign.assignedTo(updated.assignee.name) : es.assign.unassigned),
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
          if (code === 'ASSIGNEE_NOT_FOUND') void queryClient.invalidateQueries({ queryKey: peopleKey });
          if (code === 'TASK_NOT_FOUND') void queryClient.invalidateQueries({ queryKey: tasksKey });
          setFailure(errorMessage(code));
        },
      },
    );
  };

  return (
    <Dialog
      open={initial !== null}
      title={task?.title ?? ''}
      onClose={() => {
        setMode('view');
        onClose();
      }}
    >
      {notFound ? (
        <ErrorAlert message={errorMessage('TASK_NOT_FOUND')} />
      ) : (
        task &&
        (mode === 'edit' ? (
          <EditTaskForm key={task.id} task={task} onDone={() => setMode('view')} onGone={onGone} />
        ) : (
          <div className="task-detail">
            <dl className="task-detail__meta">
              <div>
                <dt>{es.detail.status}</dt>
                <dd>{STATUS_LABELS[task.status]}</dd>
              </div>
              <div>
                <dt>{es.detail.createdAt}</dt>
                <dd>
                  <time dateTime={task.createdAt}>{dateFormat.format(new Date(task.createdAt))}</time>
                </dd>
              </div>
            </dl>
            <div className="task-detail__assignee">
              <AssigneeSelect
                label={es.assign.label}
                value={task.assignee?.id ?? null}
                onChange={assign}
                disabled={update.isPending}
              />
              {update.isPending && <p className="task-detail__saving">{es.saving}</p>}
              {failure && <ErrorAlert message={failure} />}
            </div>
            <h3 className="task-detail__subheading">{es.detail.description}</h3>
            <p className="task-detail__description">{task.description || es.detail.noDescription}</p>
            {mode === 'delete' ? (
              <DeleteTaskConfirm
                task={task}
                onCancel={() => setMode('view')}
                onGone={onGone}
                onDeleted={(deleted, viaKeyboard) => {
                  setMode('view');
                  onDeleted(deleted, viaKeyboard);
                }}
              />
            ) : (
              <div className="task-detail__actions">
                <Button onClick={() => setMode('edit')}>{es.edit.edit}</Button>
                <Button variant="danger" onClick={() => setMode('delete')}>
                  {es.remove.remove}
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </Dialog>
  );
};
