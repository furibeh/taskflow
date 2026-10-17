import { initBoard, systemClock } from '@taskflow/domain';
import { loadEnv } from '../config/env';
import { createDb } from '../persistence/db';
import { KyselyBoardRepository } from '../persistence/repositories/board-repository';
import { nodeAccessCodeService, uuidGenerator } from '../security/access-code';
import { boardLink } from './board-link';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

try {
  const result = await initBoard({
    boards: new KyselyBoardRepository(db),
    accessCodes: nodeAccessCodeService,
    clock: systemClock,
    ids: uuidGenerator,
  });
  if (result.created) {
    console.log('Tablero creado. Guarda este enlace: no se volverá a mostrar.');
    console.log(`Enlace del tablero: ${boardLink(env.PUBLIC_WEB_URL, result.accessCode)}`);
  } else {
    console.log('El tablero ya existe. Si has perdido el enlace, usa: npm run board:rotate');
  }
} finally {
  await db.destroy();
}
