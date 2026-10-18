import { listBoards } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { runCli } from './args';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Lista los tableros para administrarlos por id (FR-119); nunca muestra códigos ni hashes.
await runCli(async () => {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const boards = await listBoards({ boards: new KyselyBoardRepository(db) });
    if (boards.length === 0) {
      console.log('No hay tableros. Crea uno con: npm run board:create -- --name "<nombre>"');
      return;
    }
    console.log('id | nombre | creado | tareas | personas | última actividad');
    for (const b of boards) {
      console.log(
        [
          b.id,
          b.name,
          b.createdAt.toISOString(),
          plural(b.taskCount, 'tarea', 'tareas'),
          plural(b.personCount, 'persona', 'personas'),
          b.lastActivityAt.toISOString(),
        ].join(' | '),
      );
    }
  } finally {
    await db.destroy();
  }
});
