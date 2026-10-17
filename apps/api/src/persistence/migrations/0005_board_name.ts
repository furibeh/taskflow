import { sql, type Kysely } from 'kysely';

// Feature 002 (plan D15): nombre visible del tablero y fecha de su último cambio.
export async function up(db: Kysely<unknown>): Promise<void> {
  // El tablero existente se llama "Mi tablero" (FR-118); después el valor lo aporta el dominio.
  await db.schema
    .alterTable('board')
    .addColumn('name', 'text', (c) => c.notNull().defaultTo('Mi tablero'))
    .execute();
  await sql`ALTER TABLE board ADD CONSTRAINT board_name_length CHECK (char_length(name) BETWEEN 1 AND 60)`.execute(
    db,
  );
  await db.schema.alterTable('board').alterColumn('name', (c) => c.dropDefault()).execute();

  await db.schema.alterTable('board').addColumn('updated_at', 'timestamptz').execute();
  await sql`UPDATE board SET updated_at = created_at`.execute(db);
  await db.schema.alterTable('board').alterColumn('updated_at', (c) => c.setNotNull()).execute();
}

// Reversible; se pierde el nombre de los tableros.
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('board').dropColumn('updated_at').execute();
  await db.schema.alterTable('board').dropColumn('name').execute();
}
