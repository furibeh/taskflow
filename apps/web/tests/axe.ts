import axe from 'axe-core';
import { expect } from 'vitest';

/** Auditoría axe (WCAG 2.1 A/AA). El contraste no es evaluable en jsdom; lo cubren los E2E. */
export const expectNoAxeViolations = async (container: Element): Promise<void> => {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
