import { charLength } from '@taskflow/contracts';

/** Impide superar el límite en caracteres (code points) al escribir o pegar. */
export const clampChars = (value: string, max: number): string =>
  charLength(value) > max ? Array.from(value).slice(0, max).join('') : value;
