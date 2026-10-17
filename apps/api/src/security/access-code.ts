import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AccessCodeService, IdGenerator } from '@taskflow/domain';

/** Código de 32 bytes aleatorios (256 bits) en base64url, 43 caracteres (research.md R7). */
export const nodeAccessCodeService: AccessCodeService = {
  generate: () => randomBytes(32).toString('base64url'),
  hash: (code) => new Uint8Array(createHash('sha256').update(code, 'utf8').digest()),
};

export const uuidGenerator: IdGenerator = { newId: () => randomUUID() };
