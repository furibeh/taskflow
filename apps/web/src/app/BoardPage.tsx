import type { TaskDto } from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { usePeople } from '../api/people';
import { tasksQueryKey, useTasks } from '../api/tasks';
import { Board } from '../features/board/Board';
import { FiltersBar } from '../features/filters/FiltersBar';
import { NoResults } from '../features/filters/NoResults';
import { useFilters } from '../features/filters/useFilters';
import { CreateTaskForm } from '../features/tasks/CreateTaskForm';
import { TaskDetailDialog } from '../features/tasks/TaskDetailDialog';
import { UndoDeleteToast } from '../features/tasks/UndoDeleteToast';
import { ApiError } from '../api/client';
import { errorMessage, es } from '../i18n/es';
import { ErrorAlert } from '../ui/ErrorAlert';
import { OperationError, OperationFeedbackProvider } from '../ui/OperationFeedback';

/** Página principal: creación, búsqueda y filtros, tablero y detalle de tarea. */
export const BoardPage = () => {
  const filters = useFilters();
  const tasks = useTasks(filters.query);
  const people = usePeople();
  const queryClient = useQueryClient();
  const [openTask, setOpenTask] = useState<TaskDto | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ task: TaskDto; viaKeyboard: boolean } | null>(null);
  const dismissUndo = useCallback(() => setLastDeleted(null), []);
  // Aviso ligado a la consulta en la que se creó la tarea: desaparece al cambiar los filtros.
  const [hiddenNoticeFor, setHiddenNoticeFor] = useState<typeof filters.query | null>(null);
  const { assignee, setAssignee } = filters;

  // Si la persona filtrada ya no existe, el filtro vuelve a "Todos" (US4, escenario 11).
  useEffect(() => {
    const knownPeople = people.data;
    if (!knownPeople || assignee === 'all' || assignee === 'unassigned') return;
    if (!knownPeople.some((p) => p.id === assignee)) setAssignee('all');
  }, [people.data, assignee, setAssignee]);

  // La tarea se crea aunque no cumpla los filtros; se avisa de que no está visible (US4).
  const onCreated = (task: TaskDto) => {
    const visible = queryClient
      .getQueryData<{ items: TaskDto[] }>(tasksQueryKey(filters.query))
      ?.items.some((t) => t.id === task.id);
    setHiddenNoticeFor(filters.isActive && !visible ? filters.query : null);
  };

  const items = tasks.data?.items;

  return (
    <OperationFeedbackProvider>
      <main className="page">
        <CreateTaskForm onCreated={onCreated} />
        {hiddenNoticeFor === filters.query && (
          <p className="hidden-notice" role="status">
            {es.filters.hiddenCreated}
          </p>
        )}
        <FiltersBar filters={filters} />
        <OperationError />
        {tasks.isPending && <p>{es.loading}</p>}
        {tasks.isError && (
          <ErrorAlert
            message={
              tasks.error instanceof ApiError && tasks.error.code === 'RATE_LIMITED'
                ? errorMessage('RATE_LIMITED')
                : es.loadError
            }
            onRetry={() => void tasks.refetch()}
          />
        )}
        {items && (
          <>
            {items.length === 0 && !filters.isActive && <p className="page__empty">{es.board.emptyBoard}</p>}
            {items.length === 0 && filters.isActive ? (
              <NoResults search={filters.appliedSearch} onClear={filters.clearAll} />
            ) : (
              <Board tasks={items} onOpenTask={setOpenTask} />
            )}
          </>
        )}
        <TaskDetailDialog
          task={openTask}
          onClose={() => setOpenTask(null)}
          onDeleted={(task, viaKeyboard) => {
            setOpenTask(null);
            setLastDeleted({ task, viaKeyboard });
          }}
        />
        {lastDeleted && (
          <UndoDeleteToast
            key={lastDeleted.task.id}
            task={lastDeleted.task}
            focusOnShow={lastDeleted.viaKeyboard}
            onDone={dismissUndo}
          />
        )}
      </main>
    </OperationFeedbackProvider>
  );
};
