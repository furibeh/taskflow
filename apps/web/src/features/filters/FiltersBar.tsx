import { SEARCH_MAX, TASK_STATUSES } from '@taskflow/contracts';
import { useId } from 'react';
import { usePeople } from '../../api/people';
import { es, STATUS_LABELS } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { clampChars } from '../tasks/textInput';
import type { FiltersState } from './useFilters';
import './filters.css';

/** Búsqueda por texto y filtros por responsable y estado, siempre visibles (FR-025). */
export const FiltersBar = ({ filters }: { readonly filters: FiltersState }) => {
  const ids = { search: useId(), assignee: useId(), heading: useId() };
  const people = usePeople();

  const assigneeLabel =
    filters.assignee === 'unassigned'
      ? es.unassigned
      : people.data?.find((p) => p.id === filters.assignee)?.name;
  const summary = [
    filters.appliedSearch && `«${filters.appliedSearch}»`,
    filters.assignee !== 'all' && assigneeLabel && `${es.filters.assignee}: ${assigneeLabel}`,
    filters.statuses.length < TASK_STATUSES.length &&
      `${es.filters.statuses}: ${filters.statuses.map((s) => STATUS_LABELS[s]).join(', ')}`,
  ].filter(Boolean);

  return (
    <section className="filters" aria-labelledby={ids.heading}>
      <h2 id={ids.heading} className="visually-hidden">
        {es.filters.heading}
      </h2>
      <div className="filters__row">
        <div className="field filters__search">
          <label htmlFor={ids.search} className="field__label">
            {es.filters.search}
          </label>
          <input
            id={ids.search}
            type="search"
            className="field__input"
            value={filters.searchInput}
            onChange={(e) => filters.setSearchInput(clampChars(e.target.value, SEARCH_MAX))}
          />
        </div>
        <div className="field">
          <label htmlFor={ids.assignee} className="field__label">
            {es.filters.byAssignee}
          </label>
          <select
            id={ids.assignee}
            className="field__input"
            value={filters.assignee}
            onChange={(e) => filters.setAssignee(e.target.value)}
          >
            <option value="all">{es.filters.all}</option>
            <option value="unassigned">{es.unassigned}</option>
            {people.data?.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="filters__statuses">
          <legend className="field__label">{es.filters.statuses}</legend>
          {TASK_STATUSES.map((status) => {
            const checked = filters.statuses.includes(status);
            const onlyOne = checked && filters.statuses.length === 1;
            return (
              <label key={status} className="filters__check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={onlyOne}
                  onChange={() => filters.toggleStatus(status)}
                />
                {STATUS_LABELS[status]}
              </label>
            );
          })}
        </fieldset>
      </div>
      {filters.isActive && (
        <div className="filters__active">
          <p className="filters__summary">
            {es.filters.active}: {summary.join(' · ')}
          </p>
          <Button onClick={filters.clearAll}>{es.filters.clearAll}</Button>
        </div>
      )}
    </section>
  );
};
