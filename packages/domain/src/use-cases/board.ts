import { parseBoardName, type AccessCodeService, type Board, type BoardRepository, type BoardStats } from '../board/board';
import type { Clock } from '../shared/clock';
import { validationError, type DomainError } from '../shared/errors';
import type { IdGenerator } from '../shared/ids';
import { DEFAULT_BOARD_NAME } from '../shared/limits';
import { err, ok, type Result } from '../shared/result';

interface BoardDeps {
  readonly boards: BoardRepository;
  readonly accessCodes: AccessCodeService;
  readonly clock: Clock;
}

export type CreateBoardResult =
  | { readonly created: true; readonly board: Board; readonly accessCode: string }
  | { readonly created: false; readonly board: Board };

/**
 * Crea un tablero con el id del cliente (FR-102–FR-104). El código lo genera siempre el
 * servidor y solo se devuelve al crearlo: una repetición con el mismo id y nombre devuelve el
 * tablero sin código, porque solo se guarda su hash (research R19, D13).
 */
export const createBoard = async (
  deps: BoardDeps,
  input: { readonly id: string; readonly name: string },
): Promise<Result<CreateBoardResult, DomainError>> => {
  const name = parseBoardName(input.name);
  if (!name.ok) return err(validationError(name.error));

  const existing = await deps.boards.findById(input.id);
  if (existing) {
    return existing.name === name.value ? ok({ created: false, board: existing }) : err({ code: 'ID_CONFLICT' });
  }

  const accessCode = deps.accessCodes.generate();
  const now = deps.clock.now();
  const board: Board = {
    id: input.id,
    name: name.value,
    accessCodeHash: deps.accessCodes.hash(accessCode),
    accessCodeRotatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  // Otra petición con el mismo id puede haberse adelantado entre la consulta y la inserción.
  if ((await deps.boards.insert(board)) === 'id_taken') return err({ code: 'ID_CONFLICT' });
  return ok({ created: true, board, accessCode });
};

export type InitBoardResult =
  | { readonly created: true; readonly board: Board; readonly accessCode: string }
  | { readonly created: false };

/** Crea "Mi tablero" si la instalación no tiene ninguno (consola, Compose). */
export const initBoard = async (
  deps: BoardDeps & { readonly ids: IdGenerator },
): Promise<InitBoardResult> => {
  if ((await deps.boards.count()) > 0) return { created: false };
  const result = await createBoard(deps, { id: deps.ids.newId(), name: DEFAULT_BOARD_NAME });
  if (!result.ok || !result.value.created) return { created: false };
  return result.value;
};

/** Devuelve el tablero del código, o null si el código falta o no es válido (FR-028c). */
export const resolveBoard = async (
  deps: Pick<BoardDeps, 'boards' | 'accessCodes'>,
  accessCode: string | undefined,
): Promise<Board | null> => {
  if (!accessCode) return null;
  return deps.boards.findByAccessCodeHash(deps.accessCodes.hash(accessCode));
};

/** Datos del tablero abierto, con los recuentos de la confirmación de borrado (FR-115). */
export const getBoardDetails = async (
  deps: Pick<BoardDeps, 'boards'>,
  board: Board,
): Promise<Board & BoardStats> => ({ ...board, ...(await deps.boards.getStats(board.id)) });

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
