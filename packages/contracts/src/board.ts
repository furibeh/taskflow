import { z } from 'zod';

export const BoardSchema = z.strictObject({
  id: z.uuid(),
  accessCodeRotatedAt: z.iso.datetime(),
});
export type BoardDto = z.infer<typeof BoardSchema>;

export const ACCESS_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const RegenerateAccessCodeResponseSchema = z.strictObject({
  accessCode: z.string().regex(ACCESS_CODE_PATTERN),
  rotatedAt: z.iso.datetime(),
});
export type RegenerateAccessCodeResponse = z.infer<typeof RegenerateAccessCodeResponseSchema>;
