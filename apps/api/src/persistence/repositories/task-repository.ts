import type { Task, TaskCriteria, TaskRepository, TaskView } from '@taskflow/domain';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db';

const UNIQUE_VIOLATION = '23505';

/** Escapa los comodines de LIKE para que el texto se busque de forma literal. */
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;

export class KyselyTaskRepository implements TaskRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async insert(task: Task): Promise<'inserted' | 'id_taken'> {
    try {
      await this.db
        .insertInto('task')
        .values({
          id: task.id,
          board_id: task.boardId,
          title: task.title,
          description: task.description,
          status: task.status,
          assignee_id: task.assigneeId,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
          deleted_at: null,
        })
        .execute();
      return 'inserted';
    } catch (error) {
      if (isUniqueViolation(error)) return 'id_taken';
      throw error;
    }
  }

  async findById(boardId: string, id: string): Promise<TaskView | null> {
    const row = await this.baseQuery(boardId).where('task.id', '=', id).executeTakeFirst();
    return row ? toView(row) : null;
  }

  async list(boardId: string, criteria: TaskCriteria): Promise<TaskView[]> {
    let query = this.baseQuery(boardId);
    if (criteria.assignee === 'unassigned') query = query.where('task.assignee_id', 'is', null);
    else if (criteria.assignee) query = query.where('task.assignee_id', '=', criteria.assignee);
    if (criteria.statuses?.length) query = query.where('task.status', 'in', [...criteria.statuses]);
    if (criteria.text) {
      // Búsqueda literal sin distinguir mayúsculas ni tildes (FR-024a, FR-024b, R12).
      const pattern = `%${escapeLike(criteria.text)}%`;
      query = query.where((eb) =>
        eb.or([
          eb(sql`unaccent(lower(task.title))`, 'like', sql`unaccent(lower(${pattern})) ESCAPE '\\'`),
          eb(sql`unaccent(lower(task.description))`, 'like', sql`unaccent(lower(${pattern})) ESCAPE '\\'`),
        ]),
      );
    }
    const rows = await query
      .orderBy('task.created_at', 'desc')
      .orderBy('task.id', 'desc')
      .execute();
    return rows.map(toView);
  }

  async update(task: Task): Promise<TaskView | null> {
    const result = await this.db
      .updateTable('task')
      .set({
        title: task.title,
        description: task.description,
        status: task.status,
        assignee_id: task.assigneeId,
        updated_at: task.updatedAt,
      })
      .where('id', '=', task.id)
      .where('board_id', '=', task.boardId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) return null;
    return this.findById(task.boardId, task.id);
  }

  async softDelete(boardId: string, id: string, deletedAt: Date): Promise<boolean> {
    // La fecha la decide el dominio (su reloj), nunca now() de SQL (convergencia F2).
    const result = await this.db
      .updateTable('task')
      .set({ deleted_at: deletedAt })
      .where('id', '=', id)
      .where('board_id', '=', boardId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async findDeletedById(boardId: string, id: string): Promise<{ task: TaskView; deletedAt: Date } | null> {
    const row = await this.selectQuery(boardId)
      .select('task.deleted_at')
      .where('task.id', '=', id)
      .where('task.deleted_at', 'is not', null)
      .executeTakeFirst();
    return row?.deleted_at ? { task: toView(row), deletedAt: row.deleted_at } : null;
  }

  async restore(boardId: string, id: string): Promise<TaskView | null> {
    const result = await this.db
      .updateTable('task')
      .set({ deleted_at: null })
      .where('id', '=', id)
      .where('board_id', '=', boardId)
      .where('deleted_at', 'is not', null)
      .executeTakeFirst();
    return result.numUpdatedRows > 0n ? this.findById(boardId, id) : null;
  }

  async purgeDeletedBefore(date: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('task')
      .where('deleted_at', 'is not', null)
      .where('deleted_at', '<', date)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  private baseQuery(boardId: string) {
    return this.selectQuery(boardId).where('task.deleted_at', 'is', null);
  }

  private selectQuery(boardId: string) {
    return this.db
      .selectFrom('task')
      .leftJoin('person', 'person.id', 'task.assignee_id')
      .select([
        'task.id',
        'task.board_id',
        'task.title',
        'task.description',
        'task.status',
        'task.assignee_id',
        'task.created_at',
        'task.updated_at',
        'person.name as assignee_name',
      ])
      .where('task.board_id', '=', boardId);
  }
}

type Row = Awaited<ReturnType<ReturnType<KyselyTaskRepository['selectQuery']>['executeTakeFirstOrThrow']>>;

const toView = (row: Row): TaskView => ({
  id: row.id,
  boardId: row.board_id,
  title: row.title,
  description: row.description,
  status: row.status,
  assigneeId: row.assignee_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  assignee:
    row.assignee_id && row.assignee_name ? { id: row.assignee_id, name: row.assignee_name } : null,
});
