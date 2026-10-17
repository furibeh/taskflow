import { regenerateAccessCode, systemClock } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { nodeAccessCodeService } from '../security/access-code';
import { boardLink } from './board-link';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

try {
  const boards = new KyselyBoardRepository(db);
  const board = await boards.findAny();
  if (!board) {
    console.error('No existe ningún tablero. Ejecuta primero: npm run board:init');
    process.exitCode = 1;
  } else {
    const { accessCode } = await regenerateAccessCode(
      { boards, accessCodes: nodeAccessCodeService, clock: systemClock },
      board.id,
    );
    console.log('Enlace regenerado. El enlace anterior ha dejado de funcionar.');
    console.log(`Enlace del tablero: ${boardLink(env.PUBLIC_WEB_URL, accessCode)}`);
  }
} finally {
  await db.destroy();
}
