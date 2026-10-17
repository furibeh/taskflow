import type { Board } from '@taskflow/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { KyselyBoardRepository } from '../../src/persistence/repositories/board-repository';
import { createTestDb, truncateAll } from '../support/test-db';

const db = createTestDb();
const boards = new KyselyBoardRepository(db);

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'a0000000-0000-4000-8000-000000000002';
const T0 = new Date('2026-10-17T10:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const board = (id: string, name: string, createdAt: Date): Board => ({
  id,
  name,
  accessCodeHash: new Uint8Array(32).fill(id === A ? 1 : 2),
  accessCodeRotatedAt: createdAt,
  createdAt,
  updatedAt: createdAt,
});

const addPerson = (id: string, boardId: string, createdAt: Date) =>
  db.insertInto('person').values({ id, board_id: boardId, name: `P-${id.slice(-2)}`, created_at: createdAt }).execute();

const addTask = (id: string, boardId: string, updatedAt: Date, deletedAt: Date | null = null) =>
  db
    .insertInto('task')
    .values({
      id,
      board_id: boardId,
      title: 'Tarea',
      assignee_id: null,
      created_at: T0,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    })
    .execute();

afterAll(async () => {
  await db.destroy();
});

describe('KyselyBoardRepository (feature 002)', () => {
  beforeEach(async () => {
    await truncateAll(db);
    await boards.insert(board(A, 'Equipo A', T0));
    await boards.insert(board(B, 'Equipo B', at(1)));
  });

  it('insert indica si el id ya existía', async () => {
    expect(await boards.insert(board(A, 'Otro', T0))).toBe('id_taken');
    expect(await boards.count()).toBe(2);
  });

  it('findById devuelve el tablero con su nombre y fechas', async () => {
    expect(await boards.findById(A)).toMatchObject({ id: A, name: 'Equipo A', createdAt: T0, updatedAt: T0 });
    expect(await boards.findById('a0000000-0000-4000-8000-000000000009')).toBeNull();
  });

  it('rename cambia el nombre y updated_at; false si el tablero no existe', async () => {
    expect(await boards.rename(A, 'Diseño y UX', at(5))).toBe(true);
    expect(await boards.findById(A)).toMatchObject({ name: 'Diseño y UX', updatedAt: at(5) });
    expect(await boards.rename('a0000000-0000-4000-8000-000000000009', 'X', at(5))).toBe(false);
  });

  it('updateAccessCodeHash también actualiza updated_at', async () => {
    await boards.updateAccessCodeHash(A, new Uint8Array(32).fill(7), at(3));
    expect(await boards.findById(A)).toMatchObject({ accessCodeRotatedAt: at(3), updatedAt: at(3) });
  });

  it('getStats cuenta tareas no borradas y personas del tablero', async () => {
    await addPerson('c0000000-0000-4000-8000-000000000001', A, T0);
    await addPerson('c0000000-0000-4000-8000-000000000002', B, T0);
    await addTask('d0000000-0000-4000-8000-000000000001', A, T0);
    await addTask('d0000000-0000-4000-8000-000000000002', A, T0, at(1));
    await addTask('d0000000-0000-4000-8000-000000000003', B, T0);

    expect(await boards.getStats(A)).toEqual({ taskCount: 1, personCount: 1 });
  });

  it('delete borra el tablero con sus personas y tareas (también las borradas) y nada más', async () => {
    await addPerson('c0000000-0000-4000-8000-000000000001', A, T0);
    await addPerson('c0000000-0000-4000-8000-000000000002', B, T0);
    await addTask('d0000000-0000-4000-8000-000000000001', A, T0);
    await addTask('d0000000-0000-4000-8000-000000000002', A, T0, at(1));
    await addTask('d0000000-0000-4000-8000-000000000003', B, T0);

    expect(await boards.delete(A)).toBe(true);
    expect(await boards.delete(A)).toBe(false);

    expect(await boards.findById(A)).toBeNull();
    expect(await db.selectFrom('person').select('board_id').execute()).toEqual([{ board_id: B }]);
    expect(await db.selectFrom('task').select('board_id').execute()).toEqual([{ board_id: B }]);
    expect(await boards.getStats(B)).toEqual({ taskCount: 1, personCount: 1 });
  });

  it('listSummaries ordena por creación y calcula la última actividad (research R24)', async () => {
    await addPerson('c0000000-0000-4000-8000-000000000001', A, at(2));
    await addTask('d0000000-0000-4000-8000-000000000001', A, at(4));
    await addTask('d0000000-0000-4000-8000-000000000002', A, at(3), at(9));

    expect(await boards.listSummaries()).toEqual([
      { id: A, name: 'Equipo A', createdAt: T0, taskCount: 1, personCount: 1, lastActivityAt: at(9) },
      { id: B, name: 'Equipo B', createdAt: at(1), taskCount: 0, personCount: 0, lastActivityAt: at(1) },
    ]);
  });
});
