import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ErrorAlert } from './ErrorAlert';

interface Failure {
  readonly message: string;
  readonly retry: (() => void) | undefined;
}

interface OperationFeedback {
  report(message: string, retry?: () => void): void;
  clear(): void;
}

const Context = createContext<OperationFeedback>({ report: () => {}, clear: () => {} });
const FailureContext = createContext<Failure | null>(null);

/**
 * Error de la última operación sobre el tablero (mover, asignar, borrar…). Se muestra en un único
 * lugar, con "Reintentar" cuando tiene sentido repetir la operación (FR-021a).
 */
export const OperationFeedbackProvider = ({ children }: { readonly children: ReactNode }) => {
  const [failure, setFailure] = useState<Failure | null>(null);
  const report = useCallback((message: string, retry?: () => void) => setFailure({ message, retry }), []);
  const clear = useCallback(() => setFailure(null), []);
  const value = useMemo(() => ({ report, clear }), [report, clear]);
  return (
    <Context.Provider value={value}>
      <FailureContext.Provider value={failure}>{children}</FailureContext.Provider>
    </Context.Provider>
  );
};

export const useOperationFeedback = (): OperationFeedback => useContext(Context);

export const OperationError = () => {
  const failure = useContext(FailureContext);
  if (!failure) return null;
  return <ErrorAlert message={failure.message} {...(failure.retry ? { onRetry: failure.retry } : {})} />;
};
