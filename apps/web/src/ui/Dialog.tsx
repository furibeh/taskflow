import { useEffect, useId, useRef, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { Button } from './Button';

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Diálogo modal nativo: el navegador atrapa el foco y el foco vuelve al elemento que lo abrió.
 * Escape no lo cierra por sí solo: llama a `onClose`, que decide (p. ej., pedir confirmación
 * antes de cerrar el aviso de un enlace nuevo, FR-103a).
 */
export const Dialog = ({ open, title, onClose, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog__header">
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <Button onClick={onClose} aria-label={es.close}>
          ✕
        </Button>
      </div>
      <div className="dialog__body">{children}</div>
    </dialog>
  );
};
