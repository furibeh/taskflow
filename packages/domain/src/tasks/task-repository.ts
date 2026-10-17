import type { Task, TaskStatus, TaskView } from './task';

/** Criterios de búsqueda; todos se combinan con AND (FR-024). Los amplía US4. */
export interface TaskCriteria {
  readonly assignee?: string | 'unassigned';
  readonly statuses?: readonly TaskStatus[];
  readonly text?: string;
}

export interface TaskRepository {
  /** 'id_taken' si ya existe una tarea con ese id (en cualquier tablero o borrada). */
  insert(task: Task): Promise<'inserted' | 'id_taken'>;
  /** Tarea no borrada del tablero, o null. */
  findById(boardId: string, id: string): Promise<TaskView | null>;
  /** Tareas no borradas del tablero, de la más reciente a la más antigua (FR-004). */
  list(boardId: string, criteria: TaskCriteria): Promise<TaskView[]>;
  /** Guarda los campos modificables de una tarea no borrada; null si ya no existe. */
  update(task: Task): Promise<TaskView | null>;
  /** Borrado lógico con la fecha que decide el dominio; false si no existe o ya estaba borrada. */
  softDelete(boardId: string, id: string, deletedAt: Date): Promise<boolean>;
  findDeletedById(boardId: string, id: string): Promise<{ task: TaskView; deletedAt: Date } | null>;
  restore(boardId: string, id: string): Promise<TaskView | null>;
  /** Elimina físicamente las tareas borradas antes de `date`; devuelve cuántas. */
  purgeDeletedBefore(date: Date): Promise<number>;
}
