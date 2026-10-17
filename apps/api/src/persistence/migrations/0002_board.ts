import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('board')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('access_code_hash', 'bytea', (c) => c.notNull().unique())
    .addColumn('access_code_rotated_at', 'timestamptz', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('board').execute();
}
