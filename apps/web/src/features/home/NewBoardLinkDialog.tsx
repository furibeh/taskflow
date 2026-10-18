import { useEffect, useId, useRef, useState } from 'react';
import { es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorAlert } from '../../ui/ErrorAlert';
import { useAnnounce } from '../../ui/LiveRegion';
import './home.css';

export interface NewBoard {
  readonly name: string;
  readonly accessCode: string;
}

interface NewBoardLinkDialogProps {
  readonly board: NewBoard;
  readonly onOpen: (accessCode: string) => void;
  readonly onClose: () => void;
}

const linkFor = (code: string): string => `${window.location.origin}${window.location.pathname}#k=${code}`;

/**
 * Enlace del tablero recién creado: es la única vez que se muestra (FR-103). Si se intenta
 * cerrar sin haberlo copiado, pide confirmación (FR-103a).
 */
export const NewBoardLinkDialog = ({ board, onOpen, onClose }: NewBoardLinkDialogProps) => {
  const linkId = useId();
  const link = linkFor(board.accessCode);
  const [copied, setCopied] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const announce = useAnnounce();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // La pregunta aparece sin mover el foco y el lector de pantalla no la anunciaba (T056): el foco
  // pasa a "Cancelar", dentro del grupo etiquetado con la pregunta, y al cancelar vuelve a
  // "Copiar enlace" en lugar de perderse.
  useEffect(() => {
    if (confirmingClose) cancelRef.current?.focus();
    else if (wasConfirming.current) copyRef.current?.focus();
    wasConfirming.current = confirmingClose;
  }, [confirmingClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setFailure(null);
      announce(es.newBoardLink.copied);
    } catch {
      setFailure(es.share.copyFailed);
    }
  };

  const requestClose = () => {
    if (copied) onClose();
    else setConfirmingClose(true);
  };

  return (
    <Dialog open title={es.newBoardLink.title(board.name)} onClose={requestClose}>
      <div className="new-board">
        <p className="new-board__warning">
          <strong>{es.newBoardLink.warning}</strong>
        </p>
        <div className="field">
          <label htmlFor={linkId} className="field__label">
            {es.newBoardLink.link}
          </label>
          <input
            id={linkId}
            className="field__input new-board__link"
            value={link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </div>
        {failure && <ErrorAlert message={failure} />}
        {confirmingClose ? (
          <div className="new-board__confirm" role="group" aria-label={es.newBoardLink.confirmClose}>
            <p className="new-board__warning">{es.newBoardLink.confirmClose}</p>
            <div className="new-board__actions">
              <Button variant="danger" onClick={onClose}>
                {es.newBoardLink.closeAnyway}
              </Button>
              <Button ref={cancelRef} onClick={() => setConfirmingClose(false)}>
                {es.newBoardLink.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="new-board__actions">
            <Button ref={copyRef} variant="primary" onClick={() => void copy()}>
              {es.newBoardLink.copy}
            </Button>
            <Button onClick={() => onOpen(board.accessCode)}>{es.newBoardLink.open}</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
