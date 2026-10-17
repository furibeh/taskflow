import type { AccessCodeService, Board, BoardRepository } from '../board/board';
import type { Clock } from '../shared/clock';
import type { IdGenerator } from '../shared/ids';

interface BoardDeps {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  readonly clock: Clock;
}

export type InitBoardResult =
  | { readonly created: true; readonly board: Board; readonly accessCode: string }
  | { readonly created: false };

/** Crea el tablero si no existe. El código solo se devuelve en el momento de crearlo. */
export const initBoard = async (
  deps: BoardDeps & { readonly ids: IdGenerator },
): Promise<InitBoardResult> => {
  if (await deps.boards.findAny()) return { created: false };

  const accessCode = deps.accessCodes.generate();
  const now = deps.clock.now();
  const board: Board = {
    id: deps.ids.newId(),
    accessCodeHash: deps.accessCodes.hash(accessCode),
    accessCodeRotatedAt: now,
    createdAt: now,
  };
  await deps.boards.insert(board);
  return { created: true, board, accessCode };
};

/** Devuelve el tablero del código, o null si el código falta o no es válido (FR-028c). */
export const resolveBoard = async (
  deps: Pick<BoardDeps, 'boards' | 'accessCodes'>,
  accessCode: string | undefined,
): Promise<Board | null> => {
  if (!accessCode) return null;
  return deps.boards.findByAccessCodeHash(deps.accessCodes.hash(accessCode));
};

/** Sustituye el código del tablero; el anterior deja de funcionar inmediatamente (FR-028b). */
export const regenerateAccessCode = async (
  deps: BoardDeps,
  boardId: string,
): Promise<{ accessCode: string; rotatedAt: Date }> => {
  const accessCode = deps.accessCodes.generate();
  const rotatedAt = deps.clock.now();
  await deps.boards.updateAccessCodeHash(boardId, deps.accessCodes.hash(accessCode), rotatedAt);
  return { accessCode, rotatedAt };
};
