/** Contador de ventana fija en memoria (válido para una sola instancia de la API). */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): void {
    const current = this.current(key);
    current.count += 1;
  }

  isBlocked(key: string): boolean {
    return this.current(key).count >= this.max;
  }

  private current(key: string): { start: number; count: number } {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
      if (this.windows.size > 10_000) this.prune(now);
    }
    return window;
  }

  private prune(now: number): void {
    for (const [key, w] of this.windows) if (now - w.start >= this.windowMs) this.windows.delete(key);
  }
}
