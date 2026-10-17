import { describe, expect, it } from 'vitest';
import { charLength, checkLength, normalizeText } from '../../../src/shared/text';

describe('normalizeText', () => {
  it('recorta espacios en los extremos', () => {
    expect(normalizeText('  Preparar demo \n')).toBe('Preparar demo');
  });

  it('aplica normalización Unicode NFC', () => {
    const decomposed = 'Revisión';
    expect(normalizeText(decomposed)).toBe('Revisión');
    expect(normalizeText(decomposed)).toBe('Revisión'.normalize('NFC'));
  });
});

describe('charLength', () => {
  it('cuenta un emoji como un carácter', () => {
    expect(charLength('😀')).toBe(1);
    expect('😀'.length).toBe(2);
  });

  it('cuenta "é" como un carácter tras normalizar', () => {
    expect(charLength(normalizeText('é'))).toBe(1);
    expect(charLength('é')).toBe(1);
  });
});

describe('checkLength', () => {
  it('devuelve too_short y too_long con el límite aplicable', () => {
    expect(checkLength('', { min: 1, max: 3 })).toEqual({ rule: 'too_short', limit: 1 });
    expect(checkLength('abcd', { min: 1, max: 3 })).toEqual({ rule: 'too_long', limit: 3 });
    expect(checkLength('abc', { min: 1, max: 3 })).toBeNull();
    expect(checkLength('😀😀😀', { min: 1, max: 3 })).toBeNull();
  });
});
