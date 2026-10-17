import { parseArgs } from 'node:util';
import { parseBoardName } from '@taskflow/domain';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Error de uso: se muestra el mensaje y el proceso termina con código 1 (FR-119a). */
export class UsageError extends Error {}

export interface BoardArgs {
  readonly name?: string;
  readonly board?: string;
  readonly confirm?: string;
}

/** Lee y valida `--name`, `--board` y `--confirm` de los comandos de tablero. */
export const parseBoardArgs = (argv: readonly string[] = process.argv.slice(2)): BoardArgs => {
  let values: { name?: string; board?: string; confirm?: string };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: { name: { type: 'string' }, board: { type: 'string' }, confirm: { type: 'string' } },
      strict: true,
    }));
  } catch (error) {
    throw new UsageError(`Argumentos no válidos: ${(error as Error).message}`);
  }

  const args: { -readonly [K in keyof BoardArgs]: BoardArgs[K] } = {};
  if (values.name !== undefined) {
    const name = parseBoardName(values.name);
    if (!name.ok) {
      throw new UsageError(
        name.error.rule === 'too_long'
          ? `--name admite como máximo ${name.error.limit} caracteres`
          : '--name no puede estar vacío',
      );
    }
    args.name = name.value;
  }
  if (values.board !== undefined) {
    if (!UUID.test(values.board)) throw new UsageError('--board debe ser el id de un tablero (ver board:list)');
    args.board = values.board.toLowerCase();
  }
  if (values.confirm !== undefined) args.confirm = values.confirm;
  return args;
};

/** Ejecuta un comando de consola traduciendo los errores de uso a código de salida 1. */
export const runCli = async (main: () => Promise<void>): Promise<void> => {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
};
