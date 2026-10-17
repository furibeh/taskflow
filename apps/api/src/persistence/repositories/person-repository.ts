import type { Person, PersonRepository, PersonWithCount } from '@taskflow/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db';

const UNIQUE_VIOLATION = '23505';

export class KyselyPersonRepository implements PersonRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async existsInBoard(boardId: string, personId: string): Promise<boolean> {
    return (await this.findById(boardId, personId)) !== null;
  }

  async insert(person: Person): Promise<'inserted' | 'id_taken' | 'name_taken'> {
    try {
      await this.db
        .insertInto('person')
        .values({ id: person.id, board_id: person.boardId, name: person.name, created_at: person.createdAt })
        .execute();
      return 'inserted';
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code !== UNIQUE_VIOLATION) throw error;
      // El índice único (board_id, lower(name)) es la garantía final ante altas simultáneas.
      return pgError.constraint === 'person_board_name_unique' ? 'name_taken' : 'id_taken';
    }
  }

  async findById(boardId: string, id: string): Promise<Person | null> {
    const row = await this.db
      .selectFrom('person')
      .selectAll()
      .where('id', '=', id)
      .where('board_id', '=', boardId)
      .executeTakeFirst();
    return row ? { id: row.id, boardId: row.board_id, name: row.name, createdAt: row.created_at } : null;
  }

  async findByNameKey(boardId: string, key: string): Promise<Person | null> {
    const row = await this.db
      .selectFrom('person')
      .selectAll()
      .where('board_id', '=', boardId)
      .where(sql<string>`lower(name)`, '=', key)
      .executeTakeFirst();
    return row ? { id: row.id, boardId: row.board_id, name: row.name, createdAt: row.created_at } : null;
  }

  async listWithAssignedCount(boardId: string): Promise<PersonWithCount[]> {
    const rows = await this.db
      .selectFrom('person')
      .select((eb) => [
        'person.id',
        'person.board_id',
        'person.name',
        'person.created_at',
        eb
          .selectFrom('task')
          .select(eb.fn.countAll<string>().as('n'))
          .whereRef('task.assignee_id', '=', 'person.id')
          .where('task.deleted_at', 'is', null)
          .as('assigned'),
      ])
      .where('person.board_id', '=', boardId)
      .orderBy(sql`lower(person.name)`)
      .orderBy('person.id')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      boardId: r.board_id,
      name: r.name,
      createdAt: r.created_at,
      assignedTaskCount: Number(r.assigned ?? 0),
    }));
  }

  async delete(boardId: string, id: string): Promise<{ unassignedTaskCount: number } | null> {
    return this.db.transaction().execute(async (trx) => {
      const { n } = await trx
        .selectFrom('task')
        .select(trx.fn.countAll<string>().as('n'))
        .where('assignee_id', '=', id)
        .where('board_id', '=', boardId)
        .where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow();
      // ON DELETE SET NULL deja sin asignar todas sus tareas, incluidas las borradas (FR-013d).
      const result = await trx
        .deleteFrom('person')
        .where('id', '=', id)
        .where('board_id', '=', boardId)
        .executeTakeFirst();
      return result.numDeletedRows === 0n ? null : { unassignedTaskCount: Number(n) };
    });
  }
}
