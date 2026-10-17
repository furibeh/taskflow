import type { Clock } from '@taskflow/domain';

/** Reloj controlable para las pruebas de la API (marcas de tiempo deterministas). */
export class FakeClockForApi implements Clock {
  private current: Date;

  constructor(start: Date = new Date('2026-10-17T10:00:00.000Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
