import { regenerateAccessCode, systemClock } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { nodeAccessCodeService } from '../security/access-code';
import { parseBoardArgs, runCli, UsageError } from './args';
import { boardLink } from './board-link';

// Regenera el enlace de un tablero. --board es obligatorio si hay más de uno (FR-119).
await runCli(async () => {
  const args = parseBoardArgs();
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const boards = new KyselyBoardRepository(db);
    let boardId = args.board;
    if (boardId === undefined) {
      const all = await boards.listSummaries();
      if (all.length === 0) throw new UsageError('No existe ningún tablero. Ejecuta primero: npm run board:init');
      if (all.length > 1) throw new UsageError('Hay varios tableros: indica --board <id> (ver board:list)');
      boardId = all[0]!.id;
    } else if (!(await boards.findById(boardId))) {
      throw new UsageError('No existe ningún tablero con ese id');
    }

    const { accessCode } = await regenerateAccessCode(
      { boards, accessCodes: nodeAccessCodeService, clock: systemClock },
      boardId,
    );
    console.log('Enlace regenerado. El enlace anterior ha dejado de funcionar.');
    console.log(`Enlace del tablero: ${boardLink(env.PUBLIC_WEB_URL, accessCode)}`);
  } finally {
    await db.destroy();
  }
});
