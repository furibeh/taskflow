import { beforeEach, describe, expect, it } from 'vitest';
import { initBoard, regenerateAccessCode, resolveBoard } from '../../../src/use-cases/board';
import {
  FakeAccessCodeService,
  FakeClock,
  InMemoryBoardRepository,
  SequentialIds,
} from '../../support/in-memory';

describe('casos de uso del tablero', () => {
  let deps: {
    boards: InMemoryBoardRepository;
    accessCodes: FakeAccessCodeService;
    clock: FakeClock;
    ids: SequentialIds;
  };

  beforeEach(() => {
    deps = {
      boards: new InMemoryBoardRepository(),
      accessCodes: new FakeAccessCodeService(),
      clock: new FakeClock(new Date('2026-10-17T10:00:00Z')),
      ids: new SequentialIds(),
    };
  });

  it('initBoard crea el tablero y devuelve el código una sola vez', async () => {
    const first = await initBoard(deps);
    expect(first.created).toBe(true);
    if (!first.created) return;
    expect(first.accessCode).toMatch(/.+/);
    expect(first.board.accessCodeRotatedAt).toEqual(deps.clock.now());

    const second = await initBoard(deps);
    expect(second).toEqual({ created: false });
    expect(deps.boards.count()).toBe(1);
  });

  it('el tablero no guarda el código en claro', async () => {
    const result = await initBoard(deps);
    if (!result.created) throw new Error('esperaba creación');
    expect(String.fromCharCode(...result.board.accessCodeHash)).not.toContain(result.accessCode);
  });

  it('resolveBoard devuelve el tablero con un código válido y null con cualquier otro', async () => {
    const result = await initBoard(deps);
    if (!result.created) throw new Error('esperaba creación');

    expect((await resolveBoard(deps, result.accessCode))?.id).toBe(result.board.id);
    expect(await resolveBoard(deps, 'incorrecto')).toBeNull();
    expect(await resolveBoard(deps, '')).toBeNull();
    expect(await resolveBoard(deps, undefined)).toBeNull();
  });

  it('regenerateAccessCode invalida el código anterior', async () => {
    const result = await initBoard(deps);
    if (!result.created) throw new Error('esperaba creación');
    deps.clock.advance(60_000);

    const rotated = await regenerateAccessCode(deps, result.board.id);

    expect(rotated.accessCode).not.toBe(result.accessCode);
    expect(rotated.rotatedAt).toEqual(deps.clock.now());
    expect(await resolveBoard(deps, result.accessCode)).toBeNull();
    expect((await resolveBoard(deps, rotated.accessCode))?.id).toBe(result.board.id);
  });
});
