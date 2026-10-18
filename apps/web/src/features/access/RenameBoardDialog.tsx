import { BOARD_NAME_MAX, BOARD_NAME_MIN, charLength, checkLength, normalizeText } from '@taskflow/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useRenameBoard } from '../../api/board';
import { ApiError } from '../../api/client';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import { clampChars } from '../tasks/textInput';
import './access.css';

interface RenameBoardDialogProps {
  readonly currentName: string;
  readonly onClose: () => void;
}

/** Cambia el nombre del tablero con guardado pesimista (US3, FR-114, FR-021a). */
export const RenameBoardDialog = ({ currentName, onClose }: RenameBoardDialogProps) => {
  const rename = useRenameBoard();
  const announce = useAnnounce();
  const nameId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = () => {
    const issue = checkLength(normalizeText(name), { min: BOARD_NAME_MIN, max: BOARD_NAME_MAX });
    setFieldError(issue ? (issue.rule === 'too_long' ? es.validation.tooLong(BOARD_NAME_MAX) : es.createBoard.nameRequired) : null);
    if (issue) {
      nameInput.current?.focus();
      return;
    }
    setFailure(null);
    rename.mutate(name, {
      onSuccess: () => {
        announce(es.boardMenu.renamed);
        onClose();
      },
      onError: (error) => setFailure(errorMessage(error instanceof ApiError ? error.code : 'INTERNAL_ERROR')),
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!rename.isPending) submit();
  };

  return (
    <Dialog open title={es.boardMenu.rename} onClose={onClose}>
      <form className="board-settings" noValidate onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={nameId} className="field__label">
            {es.createBoard.name}
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
            onChange={(e) => setName(clampChars(e.target.value, BOARD_NAME_MAX))}
          />
          <div className="field__meta">
            <span id={`${nameId}-error`} className="field__error">
              {fieldError}
            </span>
            <span id={`${nameId}-count`} className="field__count">
              {`${charLength(name)}/${BOARD_NAME_MAX}`}
            </span>
          </div>
        </div>
        {failure && <ErrorAlert message={failure} onRetry={submit} retryDisabled={rename.isPending} />}
        <div className="board-settings__actions">
          <Button type="submit" variant="primary" disabled={rename.isPending}>
            {rename.isPending ? es.saving : es.boardMenu.save}
          </Button>
          <Button onClick={onClose} disabled={rename.isPending}>
            {es.boardMenu.cancel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
