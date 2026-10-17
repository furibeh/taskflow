import type { TaskDto, TaskStatusDto } from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ApiError } from '../../api/client';
import { tasksKey, useUpdateTask } from '../../api/tasks';
import { errorMessage, es, STATUS_LABELS } from '../../i18n/es';
import { useAnnounce } from '../../ui/LiveRegion';
import { useOperationFeedback } from '../../ui/OperationFeedback';

/**
 * Cambia el estado de una tarea con las mismas reglas para el selector, el arrastre con ratón o
 * táctil y el teclado (FR-019, FR-019a, FR-021). Debe usarse en un componente que no se
 * desmonte al mover la tarjeta (el tablero), para que los avisos de éxito o error lleguen.
 */
export const useMoveTask = () => {
  const update = useUpdateTask();
  const announce = useAnnounce();
  const feedback = useOperationFeedback();
  const queryClient = useQueryClient();

  const move = useCallback(
    (task: TaskDto, status: TaskStatusDto): void => {
      if (task.status === status) return;
      const attempt = (): void => {
        feedback.clear();
        update.mutate(
          { id: task.id, patch: { status } },
          {
            onSuccess: () => announce(es.move.moved(STATUS_LABELS[status])),
            onError: (error) => {
              const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
              if (code === 'TASK_NOT_FOUND') {
                void queryClient.invalidateQueries({ queryKey: tasksKey });
                feedback.report(errorMessage(code));
                return;
              }
              feedback.report(errorMessage(code), attempt);
            },
          },
        );
      };
      attempt();
    },
    [announce, feedback, queryClient, update],
  );

  return move;
};
