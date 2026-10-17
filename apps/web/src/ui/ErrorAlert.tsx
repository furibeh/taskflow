import { es } from '../i18n/es';
import { Button } from './Button';

interface ErrorAlertProps {
  readonly message: string;
  readonly onRetry?: () => void;
  readonly retryDisabled?: boolean;
}

/** Error de una operación: se anuncia de inmediato (role="alert") y ofrece reintentar. */
export const ErrorAlert = ({ message, onRetry, retryDisabled = false }: ErrorAlertProps) => (
  <div className="alert" role="alert">
    <p className="alert__message">{message}</p>
    {onRetry && (
      <Button onClick={onRetry} disabled={retryDisabled}>
        {es.retry}
      </Button>
    )}
  </div>
);
