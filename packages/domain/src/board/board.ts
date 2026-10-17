import type { ValidationIssue } from '../shared/errors';
import { BOARD_NAME_MAX, BOARD_NAME_MIN } from '../shared/limits';
import { err, ok, type Result } from '../shared/result';
import { checkLength, normalizeText } from '../shared/text';

export interface Board {
  readonly id: string;
  /** Nombre visible, 1–60 caracteres; no es único (FR-112). */
  readonly name: string;
  /** SHA-256 del código de acceso; el código en claro nunca se persiste (FR-028a). */
  readonly accessCodeHash: Uint8Array;
  readonly accessCodeRotatedAt: Date;
  readonly createdAt: Date;
  /** Último cambio del propio tablero (renombrar, regenerar el enlace). */
  readonly updatedAt: Date;
}

/** Recuentos para la confirmación de borrado (FR-115). */
export interface BoardStats {
  /** Tareas no borradas. */
  readonly taskCount: number;
  readonly personCount: number;
}

/** Fila del listado de consola (FR-119); nunca incluye el código ni su hash. */
export interface BoardSummary extends BoardStats {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  /** Cambio más reciente del tablero, sus tareas o sus personas (research R24). */
  readonly lastActivityAt: Date;
}

/** Nombre de 1–60 caracteres tras normalizar (FR-112). */
export const parseBoardName = (raw: string): Result<string, ValidationIssue> => {
  const name = normalizeText(raw);
  const issue = checkLength(name, { min: BOARD_NAME_MIN, max: BOARD_NAME_MAX });
  return issue ? err({ field: 'name', ...issue }) : ok(name);
};

export interface BoardRepository {
  findByAccessCodeHash(hash: Uint8Array): Promise<Board | null>;
  findById(id: string): Promise<Board | null>;
  count(): Promise<number>;
  insert(board: Board): Promise<'inserted' | 'id_taken'>;
  /** false si el tablero ya no existe. */
  rename(id: string, name: string, updatedAt: Date): Promise<boolean>;
  /** Actualiza también `updatedAt` con `rotatedAt`. */
  updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void>;
  /** Borra el tablero con sus tareas y personas; false si no existía (FR-116). */
  delete(id: string): Promise<boolean>;
  getStats(id: string): Promise<BoardStats>;
  /** Todos los tableros, ordenados por fecha de creación. */
  listSummaries(): Promise<BoardSummary[]>;
}

/** Genera códigos de acceso de alta entropía y calcula su hash. */
export interface AccessCodeService {
  generate(): string;
  hash(code: string): Uint8Array;
}
