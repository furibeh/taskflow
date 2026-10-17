import { FakeClockForApi } from './fake-clock';
import { initBoard, purgeDeletedTasks } from '@taskflow/domain';
import type { FastifyInstance } from 'fastify';
import { Writable } from 'node:stream';
import type { Kysely } from 'kysely';
import { buildApp, loggerOptions } from '../../src/http/app';
import { createDb, type Database } from '../../src/persistence/db';
import { KyselyBoardRepository } from '../../src/persistence/repositories/board-repository';
import { KyselyTaskRepository } from '../../src/persistence/repositories/task-repository';
import { nodeAccessCodeService, uuidGenerator } from '../../src/security/access-code';
import { createTestDb, truncateAll } from './test-db';

export interface TestApp {
  readonly app: FastifyInstance;
  readonly db: Kysely<Database>;
  readonly clock: FakeClockForApi;
  readonly boardId: string;
  readonly accessCode: string;
  /** Líneas de log capturadas (solo con captureLogs). */
  readonly logs: string[];
  authHeader(): { authorization: string };
  /** Vacía la base de datos y crea un tablero nuevo con su código. */
  reset(): Promise<void>;
  /** Crea otro tablero, lo borra y devuelve su código (que ya no debe funcionar). */
  createSecondBoardAndDeleteIt(): Promise<string>;
  /** Ejecuta una vez la purga de tareas borradas con el reloj de la prueba. */
  purge(): Promise<number>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** Reloj controlable que se pasa a los casos de uso y a la purga (T034). */
  readonly clock?: FakeClockForApi;
  /** Usa una base de datos inalcanzable para provocar errores de infraestructura. */
  readonly brokenDatabase?: boolean;
  /** Captura los logs (con la misma configuración de redacción que producción). */
  readonly captureLogs?: boolean;
}

export const buildTestApp = async (options: TestAppOptions = {}): Promise<TestApp> => {
  const clock = options.clock ?? new FakeClockForApi();
  const db = options.brokenDatabase
    ? createDb('postgres://nadie:nada@127.0.0.1:1/inexistente')
    : createTestDb();
  const logs: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logs.push(chunk.toString());
      done();
    },
  });
  const logger = options.captureLogs ? { ...(loggerOptions('info') as object), stream } : false;
  const app = await buildApp({ db, clock, rateLimits: null, logger });
  await app.ready();

  const boards = new KyselyBoardRepository(db);
  const state = { boardId: '', accessCode: '' };

  const createBoard = async () => {
    const result = await initBoard({
      boards,
      accessCodes: nodeAccessCodeService,
      clock,
      ids: uuidGenerator,
    });
    if (!result.created) throw new Error('No se pudo crear el tablero de prueba');
    return result;
  };

  return {
    app,
    db,
    clock,
    logs,
    get boardId() {
      return state.boardId;
    },
    get accessCode() {
      return state.accessCode;
    },
    authHeader: () => ({ authorization: `Bearer ${state.accessCode}` }),
    async reset() {
      await truncateAll(db);
      const result = await createBoard();
      state.boardId = result.board.id;
      state.accessCode = result.accessCode;
    },
    async createSecondBoardAndDeleteIt() {
      const code = nodeAccessCodeService.generate();
      const id = uuidGenerator.newId();
      await db
        .insertInto('board')
        .values({
          id,
          access_code_hash: Buffer.from(nodeAccessCodeService.hash(code)),
          access_code_rotated_at: clock.now(),
        })
        .execute();
      await db.deleteFrom('board').where('id', '=', id).execute();
      return code;
    },
    purge: () => purgeDeletedTasks({ tasks: new KyselyTaskRepository(db), clock }),
    async close() {
      await app.close();
      await db.destroy();
    },
  };
};
