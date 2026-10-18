import { createInterface } from 'node:readline/promises';
import { deleteBoard, getBoardDetails, normalizeText } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { parseBoardArgs, runCli, UsageError } from './args';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Pide el nombre del tablero por la entrada estándar (sin --confirm). */
const askName = async (name: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(`Escribe «${name}» para confirmar: `);
  } finally {
    rl.close();
  }
};

// Borra un tablero por su id con todas sus tareas y personas, sin deshacer (FR-119, D14).
await runCli(async () => {
  const args = parseBoardArgs();
  if (args.board === undefined) throw new UsageError('Indica el tablero: --board <id> (ver board:list)');

  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const boards = new KyselyBoardRepository(db);
    const board = await boards.findById(args.board);
    if (!board) throw new UsageError('No existe ningún tablero con ese id');

    const { taskCount, personCount } = await getBoardDetails({ boards }, board);
    const contents = `${plural(taskCount, 'tarea', 'tareas')} y ${plural(personCount, 'persona', 'personas')}`;
    console.log(`Se borrará el tablero «${board.name}» con ${contents}. No se puede deshacer.`);

    const typed = args.confirm ?? (await askName(board.name));
    if (normalizeText(typed) !== board.name) throw new UsageError('El nombre no coincide: no se ha borrado nada.');

    const result = await deleteBoard({ boards }, board.id);
    if (!result.ok) throw new UsageError('No existe ningún tablero con ese id');
    console.log(`Tablero «${board.name}» borrado (${contents}).`);
  } finally {
    await db.destroy();
  }
});
