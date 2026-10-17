export interface Board {
  readonly id: string;
  /** SHA-256 del código de acceso; el código en claro nunca se persiste (FR-028a). */
  readonly accessCodeHash: Uint8Array;
  readonly accessCodeRotatedAt: Date;
  readonly createdAt: Date;
}

export interface BoardRepository {
  findByAccessCodeHash(hash: Uint8Array): Promise<Board | null>;
  findAny(): Promise<Board | null>;
  insert(board: Board): Promise<void>;
  updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void>;
}

/** Genera códigos de acceso de alta entropía y calcula su hash. */
export interface AccessCodeService {
  generate(): string;
  hash(code: string): Uint8Array;
}
