import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  CreateBoardRequestSchema,
  CreatedBoardSchema,
  CreatedBoardWithCodeSchema,
  ERROR_CODES,
  PublicConfigSchema,
  RenameBoardRequestSchema,
} from '../src';

const ID = '7d9f1c2e-0000-4000-8000-0000000000b1';
const CODE = 'a'.repeat(43);

describe('esquemas del tablero (feature 002)', () => {
  it('CreateBoardRequest exige id y nombre de 1–60 caracteres, sin campos extra', () => {
    expect(CreateBoardRequestSchema.safeParse({ id: ID, name: ' Equipo ' }).success).toBe(true);
    expect(CreateBoardRequestSchema.safeParse({ id: ID, name: '   ' }).success).toBe(false);
    expect(CreateBoardRequestSchema.safeParse({ id: ID, name: 'a'.repeat(61) }).success).toBe(false);
    expect(CreateBoardRequestSchema.safeParse({ id: 'x', name: 'Equipo' }).success).toBe(false);
    // El código lo genera siempre el servidor (D13): el cliente no puede enviarlo.
    expect(CreateBoardRequestSchema.safeParse({ id: ID, name: 'Equipo', accessCode: CODE }).success).toBe(false);
  });

  it('la respuesta 201 lleva el código y la de una repetición no', () => {
    expect(CreatedBoardWithCodeSchema.safeParse({ id: ID, name: 'Equipo', accessCode: CODE }).success).toBe(true);
    expect(CreatedBoardWithCodeSchema.safeParse({ id: ID, name: 'Equipo', accessCode: 'corto' }).success).toBe(false);
    expect(CreatedBoardSchema.safeParse({ id: ID, name: 'Equipo' }).success).toBe(true);
    expect(CreatedBoardSchema.safeParse({ id: ID, name: 'Equipo', accessCode: CODE }).success).toBe(false);
  });

  it('Board incluye nombre y recuentos', () => {
    const board = { id: ID, name: 'Equipo', accessCodeRotatedAt: '2026-10-17T10:00:00.000Z', taskCount: 2, personCount: 1 };
    expect(BoardSchema.safeParse(board).success).toBe(true);
    expect(BoardSchema.safeParse({ ...board, taskCount: -1 }).success).toBe(false);
  });

  it('RenameBoardRequest y PublicConfig son objetos estrictos', () => {
    expect(RenameBoardRequestSchema.safeParse({ name: 'Diseño y UX' }).success).toBe(true);
    expect(RenameBoardRequestSchema.safeParse({ name: 'X', id: ID }).success).toBe(false);
    expect(PublicConfigSchema.safeParse({ boardCreationEnabled: true }).success).toBe(true);
    expect(PublicConfigSchema.safeParse({ boardCreationEnabled: true, boards: 3 }).success).toBe(false);
  });

  it('incluye los códigos de error de la creación', () => {
    expect(ERROR_CODES).toContain('BOARD_CREATION_DISABLED');
    expect(ERROR_CODES).toContain('BOARD_CREATION_LIMITED');
  });
});
