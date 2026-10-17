import {
  charLength,
  checkLength,
  DESCRIPTION_MAX,
  normalizeText,
  TITLE_MAX,
  TITLE_MIN,
  type TaskDto,
  type ValidationIssueDto,
} from '@taskflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { peopleKey } from '../../api/people';
import { useCreateTask } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import { AssigneeSelect } from './AssigneeSelect';
import { clampChars } from './textInput';
import './tasks.css';

type FieldErrors = Partial<Record<'title' | 'description', string>>;

const issueMessage = (issue: Pick<ValidationIssueDto, 'field' | 'rule' | 'limit'>): string =>
  issue.rule === 'too_long'
    ? es.validation.tooLong(issue.limit ?? (issue.field === 'title' ? TITLE_MAX : DESCRIPTION_MAX))
    : es.validation.titleRequired;

const validate = (title: string, description: string): FieldErrors => {
  const errors: FieldErrors = {};
  const titleIssue = checkLength(normalizeText(title), { min: TITLE_MIN, max: TITLE_MAX });
  if (titleIssue) errors.title = issueMessage({ field: 'title', ...titleIssue });
  const descIssue = checkLength(normalizeText(description), { min: 0, max: DESCRIPTION_MAX });
  if (descIssue) errors.description = issueMessage({ field: 'description', ...descIssue });
  return errors;
};

/** Formulario de nueva tarea (FR-007, FR-009, FR-011, FR-021). */
export const CreateTaskForm = ({ onCreated }: { readonly onCreated?: (task: TaskDto) => void }) => {
  const ids = { heading: useId(), title: useId(), desc: useId() };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  // El id se conserva entre reintentos para que el servidor no cree duplicados (FR-011).
  const pendingId = useRef<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const announce = useAnnounce();

  const submit = () => {
    const errors = validate(title, description);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      titleInput.current?.focus();
      return;
    }
    setFailure(null);
    pendingId.current ??= crypto.randomUUID();
    createTask.mutate(
      { id: pendingId.current, title, description, assigneeId },
      {
        onSuccess: (task) => {
          pendingId.current = null;
          onCreated?.(task);
          setTitle('');
          setDescription('');
          setAssigneeId(null);
          announce(es.createTask.created);
          titleInput.current?.focus();
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return setFailure(errorMessage('INTERNAL_ERROR'));
          if (error.code === 'VALIDATION_ERROR' && error.errors.length > 0) {
            const serverErrors: FieldErrors = {};
            for (const issue of error.errors) {
              if (issue.field === 'title' || issue.field === 'description') {
                serverErrors[issue.field] = issueMessage(issue);
              }
            }
            setFieldErrors(serverErrors);
            return;
          }
          if (error.code === 'ID_CONFLICT') pendingId.current = null;
          if (error.code === 'ASSIGNEE_NOT_FOUND') {
            setAssigneeId(null);
            void queryClient.invalidateQueries({ queryKey: peopleKey });
          }
          setFailure(errorMessage(error.code));
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!createTask.isPending) submit();
  };

  const saving = createTask.isPending;

  return (
    <section className="create-task" aria-labelledby={ids.heading}>
      <h2 id={ids.heading} className="create-task__heading">
        {es.createTask.heading}
      </h2>
      <form className="create-task__form" noValidate onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={ids.title} className="field__label">
            {es.createTask.title}
          </label>
          <input
            ref={titleInput}
            id={ids.title}
            className="field__input"
            value={title}
            required
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={`${ids.title}-error ${ids.title}-count`}
            onChange={(e) => setTitle(clampChars(e.target.value, TITLE_MAX))}
          />
          <div className="field__meta">
            <span id={`${ids.title}-error`} className="field__error">
              {fieldErrors.title}
            </span>
            <span id={`${ids.title}-count`} className="field__count">
              {es.createTask.counter(charLength(title), TITLE_MAX)}
            </span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.desc} className="field__label">
            {es.createTask.description}
          </label>
          <textarea
            id={ids.desc}
            className="field__input field__input--multiline"
            rows={3}
            value={description}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={`${ids.desc}-error ${ids.desc}-count`}
            onChange={(e) => setDescription(clampChars(e.target.value, DESCRIPTION_MAX))}
          />
          <div className="field__meta">
            <span id={`${ids.desc}-error`} className="field__error">
              {fieldErrors.description}
            </span>
            <span id={`${ids.desc}-count`} className="field__count">
              {es.createTask.counter(charLength(description), DESCRIPTION_MAX)}
            </span>
          </div>
        </div>
        <AssigneeSelect
          label={es.assign.optionalLabel}
          value={assigneeId}
          onChange={setAssigneeId}
          disabled={saving}
        />
        {failure && <ErrorAlert message={failure} onRetry={submit} retryDisabled={saving} />}
        <div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? es.saving : es.createTask.submit}
          </Button>
        </div>
      </form>
    </section>
  );
};
