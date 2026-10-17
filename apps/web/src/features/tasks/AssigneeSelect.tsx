import { useId } from 'react';
import { usePeople } from '../../api/people';
import { es } from '../../i18n/es';

interface AssigneeSelectProps {
  readonly label: string;
  readonly value: string | null;
  readonly onChange: (assigneeId: string | null) => void;
  readonly disabled?: boolean;
}

/** Selector de responsable: "Sin asignar" más las personas del equipo (FR-014, FR-016). */
export const AssigneeSelect = ({ label, value, onChange, disabled = false }: AssigneeSelectProps) => {
  const id = useId();
  const people = usePeople();
  const empty = people.data?.length === 0;
  // Si el responsable actual aún no está en la lista cargada, se conserva como opción.
  const options = people.data ?? [];

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <select
        id={id}
        className="field__input"
        value={value ?? ''}
        disabled={disabled}
        aria-describedby={empty ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">{es.unassigned}</option>
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      {empty && (
        <p id={`${id}-hint`} className="field__hint">
          {es.assign.hintEmpty}
        </p>
      )}
    </div>
  );
};
