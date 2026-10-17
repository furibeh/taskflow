import type { ValidationRule } from './errors';

/** Recorta espacios en los extremos y normaliza a Unicode NFC. */
export const normalizeText = (raw: string): string => raw.trim().normalize('NFC');

/** Longitud en code points, coherente con `char_length` de PostgreSQL (un emoji = 1). */
export const charLength = (text: string): number => Array.from(text).length;

export interface LengthBounds {
  readonly min: number;
  readonly max: number;
}

/** Comprueba la longitud de un texto ya normalizado. */
export const checkLength = (
  text: string,
  { min, max }: LengthBounds,
): { rule: Extract<ValidationRule, 'too_short' | 'too_long'>; limit: number } | null => {
  const length = charLength(text);
  if (length < min) return { rule: 'too_short', limit: min };
  if (length > max) return { rule: 'too_long', limit: max };
  return null;
};
