import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.createType('task_status').asEnum(['pending', 'in_progress', 'done']).execute();

  await db.schema
    .createTable('task')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('board_id', 'uuid', (c) => c.notNull().references('board.id').onDelete('cascade'))
    .addColumn('title', 'text', (c) =>
      c.notNull().check(sql`char_length(title) BETWEEN 1 AND 200`),
    )
    .addColumn('description', 'text', (c) =>
      c.notNull().defaultTo('').check(sql`char_length(description) <= 5000`),
    )
    .addColumn('status', sql`task_status`, (c) => c.notNull().defaultTo('pending'))
    .addColumn('assignee_id', 'uuid', (c) => c.references('person.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await sql`CREATE INDEX task_board_created_idx ON task (board_id, created_at DESC) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX task_assignee_idx ON task (assignee_id) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX task_deleted_idx ON task (deleted_at) WHERE deleted_at IS NOT NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task').execute();
  await db.schema.dropType('task_status').execute();
}
