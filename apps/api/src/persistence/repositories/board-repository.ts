import type { Board, BoardRepository, BoardStats, BoardSummary } from '@taskflow/domain';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { BoardTable, Database } from '../db';

const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;

const toBoard = (row: Selectable<BoardTable>): Board => ({
  id: row.id,
  name: row.name,
  accessCodeHash: new Uint8Array(row.access_code_hash),
  accessCodeRotatedAt: row.access_code_rotated_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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

  async findById(id: string): Promise<Board | null> {
    const row = await this.db.selectFrom('board').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toBoard(row) : null;
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('board')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async insert(board: Board): Promise<'inserted' | 'id_taken'> {
    try {
      await this.db
        .insertInto('board')
        .values({
          id: board.id,
          name: board.name,
          access_code_hash: Buffer.from(board.accessCodeHash),
          access_code_rotated_at: board.accessCodeRotatedAt,
          created_at: board.createdAt,
          updated_at: board.updatedAt,
        })
        .execute();
      return 'inserted';
    } catch (error) {
      if (isUniqueViolation(error) && (error as { constraint?: string }).constraint === 'board_pkey') {
        return 'id_taken';
      }
      throw error;
    }
  }

  async rename(id: string, name: string, updatedAt: Date): Promise<boolean> {
    const result = await this.db
      .updateTable('board')
      .set({ name, updated_at: updatedAt })
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void> {
    await this.db
      .updateTable('board')
      .set({ access_code_hash: Buffer.from(hash), access_code_rotated_at: rotatedAt, updated_at: rotatedAt })
      .where('id', '=', boardId)
      .execute();
  }

  async delete(id: string): Promise<boolean> {
    // ON DELETE CASCADE borra sus personas y tareas, incluidas las pendientes de purga (D14).
    const result = await this.db.deleteFrom('board').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async getStats(id: string): Promise<BoardStats> {
    const row = await this.db
      .selectNoFrom((eb) => [
        eb
          .selectFrom('task')
          .select(eb.fn.countAll<string>().as('n'))
          .where('board_id', '=', id)
          .where('deleted_at', 'is', null)
          .as('task_count'),
        eb.selectFrom('person').select(eb.fn.countAll<string>().as('n')).where('board_id', '=', id).as('person_count'),
      ])
      .executeTakeFirstOrThrow();
    return { taskCount: Number(row.task_count), personCount: Number(row.person_count) };
  }

  async listSummaries(): Promise<BoardSummary[]> {
    // Última actividad derivada (research R24): quitar una persona no deja rastro.
    const { rows } = await sql<{
      id: string;
      name: string;
      created_at: Date;
      task_count: number;
      person_count: number;
      last_activity_at: Date;
    }>`
      SELECT b.id, b.name, b.created_at,
        (SELECT count(*)::int FROM task t WHERE t.board_id = b.id AND t.deleted_at IS NULL) AS task_count,
        (SELECT count(*)::int FROM person p WHERE p.board_id = b.id) AS person_count,
        greatest(
          b.updated_at,
          (SELECT max(t.updated_at) FROM task t WHERE t.board_id = b.id),
          (SELECT max(t.deleted_at) FROM task t WHERE t.board_id = b.id),
          (SELECT max(p.created_at) FROM person p WHERE p.board_id = b.id)
        ) AS last_activity_at
      FROM board b
      ORDER BY b.created_at, b.id`.execute(this.db);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      taskCount: r.task_count,
      personCount: r.person_count,
      lastActivityAt: r.last_activity_at,
    }));
  }
}
