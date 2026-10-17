import { UNDO_WINDOW_UI_MS, type TaskDto } from '@taskflow/contracts';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { useRestoreTask } from '../../api/tasks';
import { errorMessage, es } from '../../i18n/es';
import { Button } from '../../ui/Button';
import { useAnnounce } from '../../ui/LiveRegion';
import { useOperationFeedback } from '../../ui/OperationFeedback';
import { Toast } from '../../ui/Toast';

interface UndoDeleteToastProps {
  readonly task: TaskDto;
  /** Llevar el foco a "Deshacer" (cuando se borró con el teclado). */
  readonly focusOnShow: boolean;
  readonly onDone: () => void;
}

/**
 * "Deshacer" durante 10 s tras borrar (FR-013c). El plazo nunca se pausa: si el aviso tiene el
 * foco al cumplirse, sigue visible pero el botón queda inactivo y se anuncia; se oculta al
 * expirar o al perder el foco, lo que ocurra después.
 */
export const UndoDeleteToast = ({ task, focusOnShow, onDone }: UndoDeleteToastProps) => {
  const [expired, setExpired] = useState(false);
  const focused = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const restore = useRestoreTask();
  const announce = useAnnounce();
  const feedback = useOperationFeedback();

  // Si se borró con el teclado, el diálogo de origen se cerró y su tarjeta ya no existe: el foco
  // va a "Deshacer" para que se pueda alcanzar dentro del plazo. Con ratón no se mueve el foco y
  // el aviso desaparece a los 10 s.
  useEffect(() => {
    if (focusOnShow) button.current?.focus();
  }, [focusOnShow]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExpired(true);
      if (focused.current) announce(es.remove.expired);
      else onDone();
    }, UNDO_WINDOW_UI_MS);
    return () => window.clearTimeout(timer);
  }, [announce, onDone]);

  const undo = () => {
    restore.mutate(task.id, {
      onSuccess: () => {
        announce(es.remove.restored);
        onDone();
      },
      onError: (error) => {
        feedback.report(errorMessage(error instanceof ApiError ? error.code : 'INTERNAL_ERROR'));
        onDone();
      },
    });
  };

  return (
    <Toast
      message={es.remove.deleted}
      action={
        // aria-disabled (no disabled) para no robar el foco: así el aviso se cierra al perderlo.
        <Button
          ref={button}
          variant="primary"
          onClick={() => !expired && !restore.isPending && undo()}
          aria-disabled={expired || restore.isPending}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            if (expired) onDone();
          }}
        >
          {restore.isPending ? es.saving : es.remove.undo}
        </Button>
      }
    />
  );
};
