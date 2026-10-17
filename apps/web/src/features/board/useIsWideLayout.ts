import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** true cuando caben las tres columnas a la vez (≥ 768 px). */
export const useIsWideLayout = (): boolean =>
  useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
