import {
  charLength,
  checkLength,
  normalizeText,
  PERSON_NAME_MAX,
  PERSON_NAME_MIN,
  type PersonDto,
} from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { peopleKey, useCreatePerson, useDeletePerson, usePeople } from '../../api/people';
import { tasksKey } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import { clampChars } from '../tasks/textInput';
import './people.css';

const codeOf = (error: unknown) => (error instanceof ApiError ? error.code : 'INTERNAL_ERROR');

interface PersonRowProps {
  readonly person: PersonDto;
  readonly confirming: boolean;
  readonly onAskRemove: () => void;
  readonly onCancel: () => void;
  /** La persona ya no existe (quitada por otra persona). */
  readonly onGone: () => void;
}

const PersonRow = ({ person, confirming, onAskRemove, onCancel, onGone }: PersonRowProps) => {
  const remove = useDeletePerson();
  const announce = useAnnounce();
  const [failure, setFailure] = useState<string | null>(null);

  const confirm = () => {
    setFailure(null);
    remove.mutate(person.id, {
      onSuccess: () => announce(es.people.removed(person.name)),
      onError: (error) => {
        const code = codeOf(error);
        if (code === 'PERSON_NOT_FOUND') return onGone();
        setFailure(errorMessage(code));
      },
    });
  };

  return (
    <li className="people__row">
      <div className="people__person">
        <span className="people__name">{person.name}</span>
        <span className="people__count">{es.people.assigned(person.assignedTaskCount)}</span>
      </div>
      {confirming ? (
        <div className="people__confirm" role="group" aria-label={es.people.remove(person.name)}>
          <p className="people__warning">{es.people.removeWarning(person.name, person.assignedTaskCount)}</p>
          {failure && <ErrorAlert message={failure} />}
          <div className="people__actions">
            <Button variant="danger" onClick={confirm} disabled={remove.isPending}>
              {remove.isPending ? es.saving : es.people.confirmRemove}
            </Button>
            <Button onClick={onCancel} disabled={remove.isPending}>
              {es.people.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" onClick={onAskRemove}>
          {es.people.remove(person.name)}
        </Button>
      )}
    </li>
  );
};

/** Lista de personas asignables gestionada desde la app (US6, FR-016). */
export const PeopleDialog = ({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) => {
  const people = usePeople();
  const create = useCreatePerson();
  const announce = useAnnounce();
  const nameId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const pendingId = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Otra persona ya la quitó: se avisa y se recargan personas y tareas (tabla de errores del plan).
  const onPersonGone = () => {
    setConfirmingId(null);
    setFailure(errorMessage('PERSON_NOT_FOUND'));
    void queryClient.invalidateQueries({ queryKey: peopleKey });
    void queryClient.invalidateQueries({ queryKey: tasksKey });
  };

  const submit = () => {
    const issue = checkLength(normalizeText(name), { min: PERSON_NAME_MIN, max: PERSON_NAME_MAX });
    setFieldError(issue ? (issue.rule === 'too_long' ? es.validation.tooLong(PERSON_NAME_MAX) : es.people.nameRequired) : null);
    if (issue) {
      nameInput.current?.focus();
      return;
    }
    setFailure(null);
    pendingId.current ??= crypto.randomUUID();
    create.mutate(
      { id: pendingId.current, name },
      {
        onSuccess: (person) => {
          pendingId.current = null;
          setName('');
          announce(es.people.added(person.name));
          nameInput.current?.focus();
        },
        onError: (error) => {
          const code = codeOf(error);
          if (code === 'PERSON_NAME_TAKEN' || code === 'ID_CONFLICT') pendingId.current = null;
          if (code === 'PERSON_NAME_TAKEN') return setFieldError(errorMessage(code));
          setFailure(errorMessage(code));
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!create.isPending) submit();
  };

  return (
    <Dialog open={open} title={es.people.title} onClose={onClose}>
      <form className="people__form" noValidate onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={nameId} className="field__label">
            {es.people.name}
          </label>
          <input
            ref={nameInput}
            id={nameId}
            className="field__input"
            value={name}
            required
            autoComplete="off"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={`${nameId}-error ${nameId}-count`}
            onChange={(e) => setName(clampChars(e.target.value, PERSON_NAME_MAX))}
          />
          <div className="field__meta">
            <span id={`${nameId}-error`} className="field__error">
              {fieldError}
            </span>
            <span id={`${nameId}-count`} className="field__count">
              {`${charLength(name)}/${PERSON_NAME_MAX}`}
            </span>
          </div>
        </div>
        {failure && <ErrorAlert message={failure} onRetry={submit} retryDisabled={create.isPending} />}
        <div>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? es.saving : es.people.add}
          </Button>
        </div>
      </form>

      {people.isError && <ErrorAlert message={es.loadError} onRetry={() => void people.refetch()} />}
      {people.data?.length === 0 && <p className="people__empty">{es.people.empty}</p>}
      {people.data && people.data.length > 0 && (
        <ul className="people__list" aria-label={es.people.listLabel}>
          {people.data.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              confirming={confirmingId === person.id}
              onAskRemove={() => setConfirmingId(person.id)}
              onCancel={() => setConfirmingId(null)}
              onGone={onPersonGone}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
};
