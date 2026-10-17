import { BOARD_NAME_MAX, BOARD_NAME_MIN, charLength, checkLength, normalizeText } from '@taskflow/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useCreateBoard } from '../../api/boards';
import { ApiError } from '../../api/client';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { clampChars } from '../tasks/textInput';
import { NewBoardLinkDialog, type NewBoard } from './NewBoardLinkDialog';
import './home.css';

const codeOf = (error: unknown) => (error instanceof ApiError ? error.code : 'INTERNAL_ERROR');

interface CreateBoardFormProps {
  /** Abre el tablero recién creado con su código. */
  readonly onOpenBoard: (accessCode: string) => void;
}

/**
 * Crea un tablero (US1). El id se genera una vez por intento y se reutiliza al reintentar, para
 * que un reintento tras un timeout no cree otro tablero (FR-104).
 */
export const CreateBoardForm = ({ onOpenBoard }: CreateBoardFormProps) => {
  const create = useCreateBoard();
  const nameId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const pendingId = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; retry: boolean } | null>(null);
  const [created, setCreated] = useState<NewBoard | null>(null);

  const submit = () => {
    const issue = checkLength(normalizeText(name), { min: BOARD_NAME_MIN, max: BOARD_NAME_MAX });
    setFieldError(issue ? (issue.rule === 'too_long' ? es.validation.tooLong(BOARD_NAME_MAX) : es.createBoard.nameRequired) : null);
    if (issue) {
      nameInput.current?.focus();
      return;
    }
    setFailure(null);
    pendingId.current ??= crypto.randomUUID();
    create.mutate(
      { id: pendingId.current, name },
      {
        onSuccess: (board) => {
          pendingId.current = null;
          // 200 sin código: el tablero se creó en un intento cuya respuesta se perdió (D13).
          if (!('accessCode' in board)) return setFailure({ message: es.createBoard.lostLink, retry: false });
          setName('');
          setCreated({ name: board.name, accessCode: board.accessCode });
        },
        onError: (error) => {
          const code = codeOf(error);
          if (code === 'ID_CONFLICT') {
            pendingId.current = null;
            return setFailure({ message: es.createBoard.conflict, retry: true });
          }
          setFailure({ message: errorMessage(code), retry: code !== 'BOARD_CREATION_DISABLED' });
        },
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!create.isPending) submit();
  };

  return (
    <>
      <form className="create-board" noValidate onSubmit={onSubmit} aria-label={es.createBoard.heading}>
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
        {failure && (
          <ErrorAlert
            message={failure.message}
            {...(failure.retry ? { onRetry: submit } : {})}
            retryDisabled={create.isPending}
          />
        )}
        <div>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? es.saving : es.createBoard.submit}
          </Button>
        </div>
      </form>
      {created && (
        <NewBoardLinkDialog board={created} onOpen={onOpenBoard} onClose={() => setCreated(null)} />
      )}
    </>
  );
};
