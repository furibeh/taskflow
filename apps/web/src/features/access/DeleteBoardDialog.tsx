import { normalizeText, type BoardDto } from '@taskflow/contracts';
import { useId, useState, type FormEvent } from 'react';
import { useDeleteBoard } from '../../api/board';
import { ApiError } from '../../api/client';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import './access.css';

interface DeleteBoardDialogProps {
  readonly board: BoardDto;
  readonly onDeleted: (name: string) => void;
  readonly onClose: () => void;
}

/**
 * Borrado definitivo del tablero (US4, FR-115): muestra lo que se borrará y solo se habilita al
 * escribir el nombre exacto del tablero.
 */
export const DeleteBoardDialog = ({ board, onDeleted, onClose }: DeleteBoardDialogProps) => {
  const remove = useDeleteBoard();
  const confirmId = useId();
  const [typed, setTyped] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const matches = normalizeText(typed) === board.name;

  const submit = () => {
    setFailure(null);
    remove.mutate(undefined, {
      onSuccess: () => onDeleted(board.name),
      onError: (error) => setFailure(errorMessage(error instanceof ApiError ? error.code : 'INTERNAL_ERROR')),
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (matches && !remove.isPending) submit();
  };

  return (
    <Dialog open title={es.boardMenu.delete} onClose={onClose}>
      <form className="board-settings" noValidate onSubmit={onSubmit}>
        <p className="board-settings__warning">
          {es.boardMenu.deleteWarning(board.name, board.taskCount, board.personCount)}
        </p>
        <div className="field">
          <label htmlFor={confirmId} className="field__label">
            {es.boardMenu.confirmName(board.name)}
          </label>
          <input
            id={confirmId}
            className="field__input"
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        {failure && <ErrorAlert message={failure} onRetry={submit} retryDisabled={remove.isPending} />}
        <div className="board-settings__actions">
          <Button type="submit" variant="danger" disabled={!matches || remove.isPending}>
            {remove.isPending ? es.saving : es.boardMenu.confirmDelete}
          </Button>
          <Button onClick={onClose} disabled={remove.isPending}>
            {es.boardMenu.cancel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
