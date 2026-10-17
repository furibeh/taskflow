import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('person')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('board_id', 'uuid', (c) => c.notNull().references('board.id').onDelete('cascade'))
    .addColumn('name', 'text', (c) => c.notNull().check(sql`char_length(name) BETWEEN 1 AND 50`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  // Unicidad sin distinguir mayúsculas (FR-016a).
  await sql`CREATE UNIQUE INDEX person_board_name_unique ON person (board_id, lower(name))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('person').execute();
}
