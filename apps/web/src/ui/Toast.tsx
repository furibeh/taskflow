import type { ReactNode } from 'react';

interface ToastProps {
  readonly message: string;
  readonly action?: ReactNode;
}

/** Aviso flotante no modal; su texto se anuncia mediante role="status". */
export const Toast = ({ message, action }: ToastProps) => (
  <div className="toast" role="status">
    <p className="toast__message">{message}</p>
    {action}
  </div>
);
