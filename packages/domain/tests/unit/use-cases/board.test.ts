import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_NAME } from '../../../src/shared/limits';
import {
  createBoard,
  getBoardDetails,
  initBoard,
  regenerateAccessCode,
  renameBoard,
  resolveBoard,
} from '../../../src/use-cases/board';
import {
  FakeAccessCodeService,
  FakeClock,
  InMemoryBoardRepository,
  InMemoryPeople,
  InMemoryTaskRepository,
  SequentialIds,
} from '../../support/in-memory';

const BOARD_ID = 'b0000000-0000-4000-8000-000000000001';

describe('casos de uso del tablero', () => {
  let deps: {
    boards: InMemoryBoardRepository;
    accessCodes: FakeAccessCodeService;
    clock: FakeClock;
    ids: SequentialIds;
  };
  let people: InMemoryPeople;
  let tasks: InMemoryTaskRepository;

  beforeEach(() => {
    people = new InMemoryPeople();
    tasks = new InMemoryTaskRepository(people);
    deps = {
      boards: new InMemoryBoardRepository(people, tasks),
      accessCodes: new FakeAccessCodeService(),
      clock: new FakeClock(new Date('2026-10-17T10:00:00Z')),
      ids: new SequentialIds(),
    };
  });

  describe('createBoard (FR-102–FR-104)', () => {
    it('crea el tablero con el nombre normalizado y devuelve el código una sola vez', async () => {
      const result = await createBoard(deps, { id: BOARD_ID, name: '  Equipo Diseño ' });

      expect(result.ok).toBe(true);
      if (!result.ok || !result.value.created) throw new Error('esperaba creación');
      const { board, accessCode } = result.value;
      expect(board).toMatchObject({ id: BOARD_ID, name: 'Equipo Diseño' });
      expect(board.createdAt).toEqual(deps.clock.now());
      expect(board.updatedAt).toEqual(deps.clock.now());
      expect(board.accessCodeHash).toEqual(deps.accessCodes.hash(accessCode));
      expect((await resolveBoard(deps, accessCode))?.id).toBe(BOARD_ID);
    });

    it('una repetición con el mismo id y nombre no crea otro tablero ni devuelve el código', async () => {
      const first = await createBoard(deps, { id: BOARD_ID, name: 'Equipo Diseño' });
      deps.clock.advance(5_000);
      const second = await createBoard(deps, { id: BOARD_ID, name: ' Equipo Diseño' });

      expect(second).toEqual({ ok: true, value: { created: false, board: first.ok && first.value.board } });
      expect(second.ok && 'accessCode' in second.value).toBe(false);
      expect(await deps.boards.count()).toBe(1);
    });

    it('el mismo id con otro nombre es ID_CONFLICT', async () => {
      await createBoard(deps, { id: BOARD_ID, name: 'Equipo Diseño' });
      expect(await createBoard(deps, { id: BOARD_ID, name: 'Otro' })).toEqual({
        ok: false,
        error: { code: 'ID_CONFLICT' },
      });
    });

    it('un nombre inválido no guarda nada', async () => {
      expect(await createBoard(deps, { id: BOARD_ID, name: '   ' })).toEqual({
        ok: false,
        error: { code: 'VALIDATION_ERROR', issues: [{ field: 'name', rule: 'too_short', limit: 1 }] },
      });
      expect(await deps.boards.count()).toBe(0);
    });

    it('el tablero no guarda el código en claro', async () => {
      const result = await createBoard(deps, { id: BOARD_ID, name: 'Equipo' });
      if (!result.ok || !result.value.created) throw new Error('esperaba creación');
      expect(String.fromCharCode(...result.value.board.accessCodeHash)).not.toContain(result.value.accessCode);
    });
  });

  describe('initBoard (FR-118, consola)', () => {
    it(`crea "${DEFAULT_BOARD_NAME}" solo si no hay ningún tablero`, async () => {
      const first = await initBoard(deps);
      expect(first.created).toBe(true);
      if (!first.created) return;
      expect(first.board.name).toBe(DEFAULT_BOARD_NAME);
      expect(first.accessCode).toMatch(/.+/);

      expect(await initBoard(deps)).toEqual({ created: false });
      expect(await deps.boards.count()).toBe(1);
    });

    it('no crea nada si ya existe otro tablero', async () => {
      await createBoard(deps, { id: BOARD_ID, name: 'Equipo' });
      expect(await initBoard(deps)).toEqual({ created: false });
      expect(await deps.boards.count()).toBe(1);
    });
  });

  it('resolveBoard devuelve el tablero con un código válido y null con cualquier otro', async () => {
    const result = await initBoard(deps);
    if (!result.created) throw new Error('esperaba creación');

    expect((await resolveBoard(deps, result.accessCode))?.id).toBe(result.board.id);
    expect(await resolveBoard(deps, 'incorrecto')).toBeNull();
    expect(await resolveBoard(deps, '')).toBeNull();
    expect(await resolveBoard(deps, undefined)).toBeNull();
  });

  it('regenerateAccessCode invalida el código anterior y actualiza updatedAt', async () => {
    const result = await initBoard(deps);
    if (!result.created) throw new Error('esperaba creación');
    deps.clock.advance(60_000);

    const rotated = await regenerateAccessCode(deps, result.board.id);

    expect(rotated.accessCode).not.toBe(result.accessCode);
    expect(rotated.rotatedAt).toEqual(deps.clock.now());
    expect(await resolveBoard(deps, result.accessCode)).toBeNull();
    const board = await resolveBoard(deps, rotated.accessCode);
    expect(board?.id).toBe(result.board.id);
    expect(board?.updatedAt).toEqual(deps.clock.now());
  });

  it('getBoardDetails devuelve el tablero con sus tareas no borradas y sus personas', async () => {
    const created = await createBoard(deps, { id: BOARD_ID, name: 'Equipo' });
    if (!created.ok) throw new Error('esperaba creación');
    const other = 'b0000000-0000-4000-8000-000000000002';
    const ana = people.add(BOARD_ID, 'Ana');
    people.add(other, 'Luis');
    const base = { description: '', status: 'pending' as const, assigneeId: ana, createdAt: new Date(0), updatedAt: new Date(0) };
    await tasks.insert({ ...base, id: 't1', boardId: BOARD_ID, title: 'Una' });
    await tasks.insert({ ...base, id: 't2', boardId: BOARD_ID, title: 'Borrada' });
    await tasks.insert({ ...base, id: 't3', boardId: other, title: 'Ajena', assigneeId: null });
    await tasks.softDelete(BOARD_ID, 't2', new Date(0));

    const details = await getBoardDetails(deps, created.value.board);

    expect(details).toMatchObject({ id: BOARD_ID, name: 'Equipo', taskCount: 1, personCount: 1 });
  });

  describe('renameBoard (US3, FR-114)', () => {
    it('normaliza el nombre y actualiza updatedAt', async () => {
      await createBoard(deps, { id: BOARD_ID, name: 'Equipo Diseño' });
      deps.clock.advance(60_000);

      const result = await renameBoard(deps, BOARD_ID, '  Diseño y UX ');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toMatchObject({ id: BOARD_ID, name: 'Diseño y UX', updatedAt: deps.clock.now() });
      expect(await deps.boards.findById(BOARD_ID)).toMatchObject({ name: 'Diseño y UX', updatedAt: deps.clock.now() });
    });

    it('un nombre inválido no cambia nada', async () => {
      await createBoard(deps, { id: BOARD_ID, name: 'Equipo Diseño' });
      expect(await renameBoard(deps, BOARD_ID, 'a'.repeat(61))).toEqual({
        ok: false,
        error: { code: 'VALIDATION_ERROR', issues: [{ field: 'name', rule: 'too_long', limit: 60 }] },
      });
      expect((await deps.boards.findById(BOARD_ID))?.name).toBe('Equipo Diseño');
    });

    it('si el tablero ya no existe devuelve BOARD_NOT_FOUND', async () => {
      expect(await renameBoard(deps, BOARD_ID, 'Diseño')).toEqual({ ok: false, error: { code: 'BOARD_NOT_FOUND' } });
    });
  });
});
