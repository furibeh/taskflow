import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Announce = (message: string) => void;

const LiveRegionContext = createContext<Announce>(() => {});

/** Región aria-live única para anunciar cambios a tecnologías de asistencia (FR-031). */
export const LiveRegionProvider = ({ children }: { readonly children: ReactNode }) => {
  const [message, setMessage] = useState('');

  const announce = useCallback<Announce>((text) => {
    // Vaciar primero garantiza que un mensaje repetido se vuelva a anunciar.
    setMessage('');
    window.setTimeout(() => setMessage(text), 50);
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
