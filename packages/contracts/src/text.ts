import { checkLength, normalizeText, type LengthBounds } from '@taskflow/domain';
import { z } from 'zod';

/**
 * Texto de usuario con límites en caracteres (code points) tras normalizar, igual que el
 * dominio y `char_length` de PostgreSQL. El error lleva la regla y el límite del contrato.
 */
export const boundedText = (bounds: LengthBounds) =>
  z.string().superRefine((value, ctx) => {
    const issue = checkLength(normalizeText(value), bounds);
    if (issue) ctx.addIssue({ code: 'custom', message: issue.rule, params: { ...issue } });
  });
