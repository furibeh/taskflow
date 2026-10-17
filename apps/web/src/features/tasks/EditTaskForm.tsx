import {
  charLength,
  checkLength,
  DESCRIPTION_MAX,
  normalizeText,
  TITLE_MAX,
  TITLE_MIN,
  type TaskDto,
} from '@taskflow/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { useUpdateTask } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import { clampChars } from './textInput';

interface EditTaskFormProps {
  readonly task: TaskDto;
  readonly onDone: () => void;
  /** La tarea ya no existe (borrada por otra persona): no tiene sentido reintentar. */
  readonly onGone: () => void;
}

/** Edición de título y descripción con las reglas de la creación (FR-013); no toca estado ni responsable. */
export const EditTaskForm = ({ task, onDone, onGone }: EditTaskFormProps) => {
  const ids = { title: useId(), desc: useId() };
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const update = useUpdateTask();
  const announce = useAnnounce();

  const submit = () => {
    const titleIssue = checkLength(normalizeText(title), { min: TITLE_MIN, max: TITLE_MAX });
    const descIssue = checkLength(normalizeText(description), { min: 0, max: DESCRIPTION_MAX });
    const next = {
      ...(titleIssue
        ? { title: titleIssue.rule === 'too_long' ? es.validation.tooLong(TITLE_MAX) : es.validation.titleRequired }
        : {}),
      ...(descIssue ? { description: es.validation.tooLong(DESCRIPTION_MAX) } : {}),
    };
    setErrors(next);
    if (titleIssue || descIssue) {
      titleInput.current?.focus();
      return;
    }
    setFailure(null);
    update.mutate(
      { id: task.id, patch: { title, description } },
      {
        onSuccess: () => {
          announce(es.edit.saved);
          onDone();
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
          if (code === 'TASK_NOT_FOUND') return onGone();
          setFailure(errorMessage(code));
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!update.isPending) submit();
  };

  return (
    <form className="create-task__form" noValidate onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor={ids.title} className="field__label">
          {es.edit.title}
        </label>
        <input
          ref={titleInput}
          id={ids.title}
          className="field__input"
          value={title}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={`${ids.title}-error ${ids.title}-count`}
          onChange={(e) => setTitle(clampChars(e.target.value, TITLE_MAX))}
        />
        <div className="field__meta">
          <span id={`${ids.title}-error`} className="field__error">
            {errors.title}
          </span>
          <span id={`${ids.title}-count`} className="field__count">
            {es.createTask.counter(charLength(title), TITLE_MAX)}
          </span>
        </div>
      </div>
      <div className="field">
        <label htmlFor={ids.desc} className="field__label">
          {es.edit.description}
        </label>
        <textarea
          id={ids.desc}
          className="field__input field__input--multiline"
          rows={4}
          value={description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={`${ids.desc}-error ${ids.desc}-count`}
          onChange={(e) => setDescription(clampChars(e.target.value, DESCRIPTION_MAX))}
        />
        <div className="field__meta">
          <span id={`${ids.desc}-error`} className="field__error">
            {errors.description}
          </span>
          <span id={`${ids.desc}-count`} className="field__count">
            {es.createTask.counter(charLength(description), DESCRIPTION_MAX)}
          </span>
        </div>
      </div>
      {failure && <ErrorAlert message={failure} onRetry={submit} retryDisabled={update.isPending} />}
      <div className="task-detail__actions">
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? es.saving : es.edit.save}
        </Button>
        <Button onClick={onDone} disabled={update.isPending}>
          {es.edit.cancel}
        </Button>
      </div>
    </form>
  );
};
