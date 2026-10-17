import type { TaskDto } from '@taskflow/contracts';
import { useState } from 'react';
import { useTasks } from '../api/tasks';
import { Board } from '../features/board/Board';
import { CreateTaskForm } from '../features/tasks/CreateTaskForm';
import { TaskDetailDialog } from '../features/tasks/TaskDetailDialog';
import { es } from '../i18n/es';
import { ErrorAlert } from '../ui/ErrorAlert';
import { OperationError, OperationFeedbackProvider } from '../ui/OperationFeedback';

/** Página principal: formulario de creación, tablero y detalle de tarea (US1). */
export const BoardPage = () => {
  const tasks = useTasks();
  const [openTask, setOpenTask] = useState<TaskDto | null>(null);

  return (
    <OperationFeedbackProvider>
      <main className="page">
        <CreateTaskForm />
        <OperationError />
        {tasks.isPending && <p>{es.loading}</p>}
        {tasks.isError && (
          <ErrorAlert message={es.loadError} onRetry={() => void tasks.refetch()} />
        )}
        {tasks.data && (
          <>
            {tasks.data.items.length === 0 && <p className="page__empty">{es.board.emptyBoard}</p>}
            <Board tasks={tasks.data.items} onOpenTask={setOpenTask} />
          </>
        )}
        <TaskDetailDialog task={openTask} onClose={() => setOpenTask(null)} />
      </main>
    </OperationFeedbackProvider>
  );
};
