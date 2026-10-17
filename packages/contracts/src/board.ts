import { BOARD_NAME_MAX, BOARD_NAME_MIN } from '@taskflow/domain';
import { z } from 'zod';
import { boundedText } from './text';

export const ACCESS_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Deben coincidir con components.schemas de contracts/openapi.yaml (feature 002).
export const BoardSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(BOARD_NAME_MAX),
  accessCodeRotatedAt: z.iso.datetime(),
  taskCount: z.number().int().min(0),
  personCount: z.number().int().min(0),
});
export type BoardDto = z.infer<typeof BoardSchema>;

export const BoardNameSchema = boundedText({ min: BOARD_NAME_MIN, max: BOARD_NAME_MAX });

/** El id lo genera el cliente (idempotencia); el código, siempre el servidor (D13). */
export const CreateBoardRequestSchema = z.strictObject({
  id: z.uuid(),
  name: BoardNameSchema,
});
export type CreateBoardRequest = z.infer<typeof CreateBoardRequestSchema>;

/** Repetición de una creación: el tablero ya existe y su código no se puede volver a mostrar. */
export const CreatedBoardSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(BOARD_NAME_MAX),
});
export type CreatedBoard = z.infer<typeof CreatedBoardSchema>;

/** Respuesta 201: única vez que el código sale del servidor (FR-103). */
export const CreatedBoardWithCodeSchema = CreatedBoardSchema.extend({
  accessCode: z.string().regex(ACCESS_CODE_PATTERN),
});
export type CreatedBoardWithCode = z.infer<typeof CreatedBoardWithCodeSchema>;

export const RenameBoardRequestSchema = z.strictObject({ name: BoardNameSchema });
export type RenameBoardRequest = z.infer<typeof RenameBoardRequestSchema>;

export const PublicConfigSchema = z.strictObject({ boardCreationEnabled: z.boolean() });
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export const RegenerateAccessCodeResponseSchema = z.strictObject({
  accessCode: z.string().regex(ACCESS_CODE_PATTERN),
  rotatedAt: z.iso.datetime(),
});
export type RegenerateAccessCodeResponse = z.infer<typeof RegenerateAccessCodeResponseSchema>;
