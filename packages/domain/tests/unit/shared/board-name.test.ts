import { describe, expect, it } from 'vitest';
import { parseBoardName } from '../../../src/board/board';

describe('parseBoardName (FR-112)', () => {
  it('recorta espacios y normaliza a NFC', () => {
    expect(parseBoardName('  Equipo Diséño  ')).toEqual({ ok: true, value: 'Equipo Diséño' });
  });

  it.each(['', '   '])('rechaza un nombre vacío (%j)', (raw) => {
    expect(parseBoardName(raw)).toEqual({ ok: false, error: { field: 'name', rule: 'too_short', limit: 1 } });
  });

  it('admite 60 code points y rechaza 61', () => {
    const sixty = `${'a'.repeat(59)}🚀`;
    expect(parseBoardName(sixty)).toEqual({ ok: true, value: sixty });
    expect(parseBoardName(`${sixty}b`)).toEqual({
      ok: false,
      error: { field: 'name', rule: 'too_long', limit: 60 },
    });
  });

  it('conserva el texto literal (FR-010)', () => {
    expect(parseBoardName('<b>x</b>')).toEqual({ ok: true, value: '<b>x</b>' });
  });
});
