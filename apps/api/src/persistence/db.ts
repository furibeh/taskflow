import { Kysely, PostgresDialect, type ColumnType, type Generated } from 'kysely';
import pg from 'pg';

export type TaskStatusColumn = 'pending' | 'in_progress' | 'done';

export interface BoardTable {
  id: string;
  access_code_hash: Uint8Array;
  access_code_rotated_at: Date;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface PersonTable {
  id: string;
  board_id: string;
  name: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface TaskTable {
  id: string;
  board_id: string;
  title: string;
  description: Generated<string>;
  status: Generated<TaskStatusColumn>;
  assignee_id: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  deleted_at: Date | null;
}

export interface Database {
  board: BoardTable;
  person: PersonTable;
  task: TaskTable;
}

export const createDb = (connectionString: string): Kysely<Database> =>
  new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 10 }) }),
  });
