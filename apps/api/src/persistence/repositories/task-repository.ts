import type { Task, TaskCriteria, TaskRepository, TaskView } from '@taskflow/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db';

const UNIQUE_VIOLATION = '23505';

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

  async list(boardId: string, _criteria: TaskCriteria): Promise<TaskView[]> {
    const rows = await this.baseQuery(boardId)
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

  private baseQuery(boardId: string) {
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
      .where('task.board_id', '=', boardId)
      .where('task.deleted_at', 'is', null);
  }
}

type Row = Awaited<ReturnType<ReturnType<KyselyTaskRepository['baseQuery']>['executeTakeFirstOrThrow']>>;

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
