import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Announce = (message: string) => void;

const LiveRegionContext = createContext<Announce>(() => {});

/** Región aria-live única para anunciar cambios a tecnologías de asistencia (FR-031). */
export const LiveRegionProvider = ({ children }: { readonly children: ReactNode }) => {
  const [message, setMessage] = useState('');
  const pending = useRef(new Set<number>());

  const announce = useCallback<Announce>((text) => {
    // Vaciar primero garantiza que un mensaje repetido se vuelva a anunciar.
    setMessage('');
    const timer = window.setTimeout(() => {
      pending.current.delete(timer);
      setMessage(text);
    }, 50);
    pending.current.add(timer);
  }, []);

  // Al desmontarse no debe quedar ningún anuncio pendiente (#13).
  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <LiveRegionContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="live-region">
        {message}
      </div>
    </LiveRegionContext.Provider>
  );
};

export const useAnnounce = (): Announce => useContext(LiveRegionContext);
