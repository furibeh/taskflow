import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Contrato de estilo: specs/003-neobrutalism-ui/contracts/ui-tokens.md (D18, SC-002).
const SRC = join(import.meta.dirname, '..', '..', 'src');
const TOKENS = join(SRC, 'ui', 'tokens.css');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Propiedades personalizadas del primer bloque `:root { … }` a partir de `from`. */
const rootBlock = (css: string, from = 0): Record<string, string> => {
  const start = css.indexOf(':root', from);
  if (start < 0) return {};
  const open = css.indexOf('{', start);
  const body = css.slice(open + 1, css.indexOf('}', open));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value!.trim()]),
  );
};

const css = stripComments(readFileSync(TOKENS, 'utf8'));
const light = rootBlock(css);
const darkMedia = css.search(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
// El tema oscuro hereda del claro los tokens que no redefine.
const dark = { ...light, ...(darkMedia < 0 ? {} : rootBlock(css, darkMedia)) };
const themes = { claro: light, oscuro: dark };

const luminance = (hex: string) => {
  const channels = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!channels) throw new Error(`Color no hexadecimal de 6 cifras: ${hex}`);
  const [r, g, b] = channels.slice(1).map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const STATUSES = ['pending', 'in_progress', 'done'] as const;
const COLOR_TOKENS = [
  'bg', 'surface', 'text', 'text-muted', 'border', 'shadow', 'primary', 'on-primary', 'danger',
  'on-danger', 'danger-bg', 'success-bg', 'focus', 'backdrop', 'on-status',
  ...STATUSES.flatMap((s) => [`status-${s}`, `status-${s}-soft`]),
];

const TEXT = 4.5;
const UI = 3;
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['text', 'bg', TEXT], ['text', 'surface', TEXT],
  ['text-muted', 'bg', TEXT], ['text-muted', 'surface', TEXT],
  ['border', 'bg', UI], ['border', 'surface', UI],
  ['on-primary', 'primary', TEXT], ['primary', 'surface', TEXT], ['primary', 'bg', TEXT],
  ['danger', 'surface', TEXT], ['danger', 'bg', TEXT], ['on-danger', 'danger', TEXT],
  ['text', 'danger-bg', TEXT], ['danger', 'danger-bg', TEXT], ['text', 'success-bg', TEXT],
  ['focus', 'bg', UI], ['focus', 'surface', UI],
  ...STATUSES.flatMap((s): Array<readonly [string, string, number]> => [
    ['on-status', `status-${s}`, TEXT],
    ['text', `status-${s}-soft`, TEXT],
    ['text-muted', `status-${s}-soft`, TEXT],
    ['primary', `status-${s}-soft`, TEXT],
    ['border', `status-${s}-soft`, UI],
    ['focus', `status-${s}-soft`, UI],
  ]),
];

describe('tokens de estilo (D18, contracts/ui-tokens.md)', () => {
  it.each(Object.entries(themes))('el tema %s define todos los tokens de color', (_, theme) => {
    expect(COLOR_TOKENS.filter((t) => !theme[`--color-${t}`])).toEqual([]);
  });

  it.each(Object.entries(themes))('el tema %s cumple la tabla de contrastes WCAG 2.1 AA', (_, theme) => {
    const failures = PAIRS.flatMap(([fg, bg, min]) => {
      const ratio = contrast(theme[`--color-${fg}`]!, theme[`--color-${bg}`]!);
      return ratio >= min ? [] : [`${fg} / ${bg}: ${ratio.toFixed(2)} < ${min}`];
    });
    expect(failures).toEqual([]);
  });

  it('ninguna hoja de estilo fuera de tokens.css contiene colores literales', () => {
    const sheets = (readdirSync(SRC, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.css'))
      .map((f) => join(SRC, f))
      .filter((f) => f !== TOKENS);
    const literals = sheets.flatMap((file) =>
      [...stripComments(readFileSync(file, 'utf8')).matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)].map(
        ([match]) => `${relative(SRC, file)}: ${match}`,
      ),
    );
    expect(literals).toEqual([]);
  });
});
