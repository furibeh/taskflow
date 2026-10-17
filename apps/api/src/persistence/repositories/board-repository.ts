import type { Board, BoardRepository } from '@taskflow/domain';
import type { Kysely, Selectable } from 'kysely';
import type { BoardTable, Database } from '../db';

const toBoard = (row: Selectable<BoardTable>): Board => ({
  id: row.id,
  accessCodeHash: new Uint8Array(row.access_code_hash),
  accessCodeRotatedAt: row.access_code_rotated_at,
  createdAt: row.created_at,
});

export class KyselyBoardRepository implements BoardRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByAccessCodeHash(hash: Uint8Array): Promise<Board | null> {
    const row = await this.db
      .selectFrom('board')
      .selectAll()
      .where('access_code_hash', '=', Buffer.from(hash))
      .executeTakeFirst();
    return row ? toBoard(row) : null;
  }

  async findAny(): Promise<Board | null> {
    const row = await this.db
      .selectFrom('board')
      .selectAll()
      .orderBy('created_at')
      .limit(1)
      .executeTakeFirst();
    return row ? toBoard(row) : null;
  }

  async insert(board: Board): Promise<void> {
    await this.db
      .insertInto('board')
      .values({
        id: board.id,
        access_code_hash: Buffer.from(board.accessCodeHash),
        access_code_rotated_at: board.accessCodeRotatedAt,
        created_at: board.createdAt,
      })
      .execute();
  }

  async updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void> {
    await this.db
      .updateTable('board')
      .set({ access_code_hash: Buffer.from(hash), access_code_rotated_at: rotatedAt })
      .where('id', '=', boardId)
      .execute();
  }
}
