import { TASK_STATUSES, type TaskStatusDto } from '@taskflow/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'taskflow.filters.v1';
const SEARCH_DEBOUNCE_MS = 300;

/** 'all' = todos; 'unassigned' = sin asignar; cualquier otro valor es el id de una persona. */
export type AssigneeFilter = string;

export interface Filters {
  readonly assignee: AssigneeFilter;
  readonly statuses: readonly TaskStatusDto[];
  readonly q: string;
}

const DEFAULT_FILTERS: Filters = { assignee: 'all', statuses: [...TASK_STATUSES], q: '' };

// La preferencia es por dispositivo (FR-027). El almacenamiento puede no estar disponible
// (modo privado, bloqueado): toda lectura y escritura está protegida.
const load = (): Filters => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<Filters>;
    const statuses = (parsed.statuses ?? []).filter((s): s is TaskStatusDto => TASK_STATUSES.includes(s));
    return {
      assignee: typeof parsed.assignee === 'string' && parsed.assignee ? parsed.assignee : 'all',
      statuses: statuses.length > 0 ? statuses : DEFAULT_FILTERS.statuses,
      q: typeof parsed.q === 'string' ? parsed.q : '',
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

const save = (filters: Filters): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Sin persistencia: los filtros siguen funcionando en esta sesión.
  }
};

export interface TaskQuery {
  readonly assignee?: string;
  readonly status?: readonly TaskStatusDto[];
  readonly q?: string;
}

/** Búsqueda y filtros del tablero, combinados con AND (FR-022–FR-027). */
export const useFilters = () => {
  const [initial] = useState(load);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [statuses, setStatuses] = useState<readonly TaskStatusDto[]>(initial.statuses);
  const [searchInput, setSearchInput] = useState(initial.q);
  const [q, setQ] = useState(initial.q);

  useEffect(() => {
    if (searchInput === q) return;
    const timer = window.setTimeout(() => setQ(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, q]);

  useEffect(() => save({ assignee, statuses, q }), [assignee, statuses, q]);

  /** Siempre queda al menos un estado marcado. */
  const toggleStatus = useCallback((status: TaskStatusDto) => {
    setStatuses((current) => {
      if (!current.includes(status)) return TASK_STATUSES.filter((s) => s === status || current.includes(s));
      return current.length === 1 ? current : current.filter((s) => s !== status);
    });
  }, []);

  const clearAll = useCallback(() => {
    setAssignee('all');
    setStatuses(DEFAULT_FILTERS.statuses);
    setSearchInput('');
    setQ('');
  }, []);

  const query = useMemo<TaskQuery>(() => {
    const trimmed = q.trim();
    return {
      ...(assignee === 'all' ? {} : { assignee }),
      ...(statuses.length === TASK_STATUSES.length ? {} : { status: statuses }),
      ...(trimmed ? { q: trimmed } : {}),
    };
  }, [assignee, statuses, q]);

  return {
    assignee,
    statuses,
    searchInput,
    appliedSearch: q.trim(),
    query,
    isActive: Object.keys(query).length > 0,
    setAssignee,
    toggleStatus,
    setSearchInput,
    clearAll,
  };
};

export type FiltersState = ReturnType<typeof useFilters>;
