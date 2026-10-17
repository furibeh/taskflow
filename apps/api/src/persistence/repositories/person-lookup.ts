import type { PersonLookup } from '@taskflow/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../db';

export class KyselyPersonLookup implements PersonLookup {
  constructor(private readonly db: Kysely<Database>) {}

  async existsInBoard(boardId: string, personId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('person')
      .select('id')
      .where('id', '=', personId)
      .where('board_id', '=', boardId)
      .executeTakeFirst();
    return row !== undefined;
  }
}
