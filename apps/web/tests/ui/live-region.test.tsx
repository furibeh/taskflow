import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveRegionProvider, useAnnounce } from '../../src/ui/LiveRegion';

const Announcer = ({ text }: { readonly text: string }) => {
  const announce = useAnnounce();
  useEffect(() => announce(text), [announce, text]);
  return null;
};

describe('región aria-live (FR-031)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('anuncia el mensaje tras vaciar la región', () => {
    vi.useFakeTimers();
    render(
      <LiveRegionProvider>
        <Announcer text="Tarea creada" />
      </LiveRegionProvider>,
    );

    expect(screen.getByTestId('live-region')).toHaveTextContent('');
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId('live-region')).toHaveTextContent('Tarea creada');
  });

  it('al desmontarse no deja anuncios pendientes (#13)', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <LiveRegionProvider>
        <Announcer text="Tarea creada" />
      </LiveRegionProvider>,
    );
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
