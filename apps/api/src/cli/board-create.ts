import { createBoard, systemClock } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { nodeAccessCodeService, uuidGenerator } from '../security/access-code';
import { parseBoardArgs, runCli, UsageError } from './args';
import { boardLink } from './board-link';

// Crea un tablero desde la consola (FR-119), p. ej., con la creación web desactivada.
await runCli(async () => {
  const { name } = parseBoardArgs();
  if (name === undefined) throw new UsageError('Indica el nombre: npm run board:create -- --name "<nombre>"');

  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const result = await createBoard(
      { boards: new KyselyBoardRepository(db), accessCodes: nodeAccessCodeService, clock: systemClock },
      { id: uuidGenerator.newId(), name },
    );
    if (!result.ok || !result.value.created) throw new Error('No se pudo crear el tablero');
    console.log(`Tablero «${result.value.board.name}» creado. Guarda este enlace: no se volverá a mostrar.`);
    console.log(`Enlace del tablero: ${boardLink(env.PUBLIC_WEB_URL, result.value.accessCode)}`);
  } finally {
    await db.destroy();
  }
});
