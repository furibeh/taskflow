import type { AccessCodeService, Board, BoardRepository, BoardStats, BoardSummary } from '../../src/board/board';
import type { Clock } from '../../src/shared/clock';
import type { IdGenerator } from '../../src/shared/ids';
import { personNameKey, type Person, type PersonRepository, type PersonWithCount } from '../../src/people/person';
import type { Task, TaskStatus, TaskView } from '../../src/tasks/task';
import { matchesCriteria } from '../../src/tasks/task-criteria';
import type { TaskCriteria, TaskRepository } from '../../src/tasks/task-repository';

export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date = new Date('2026-10-17T10:00:00Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIds implements IdGenerator {
  private next = 1;

  newId(): string {
    const n = String(this.next++).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }
}

/** Hash determinista de prueba (FNV-1a con cuatro semillas); no es criptográfico. */
export class FakeAccessCodeService implements AccessCodeService {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `codigo-de-prueba-${this.counter}`;
  }

  hash(code: string): Uint8Array {
    const out = new Uint8Array(16);
    const view = new DataView(out.buffer);
    [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x12345678].forEach((seed, i) => {
      let h = seed >>> 0;
      for (const ch of code) {
        h ^= ch.codePointAt(0) ?? 0;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      view.setUint32(i * 4, h);
    });
    return out;
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

export class InMemoryBoardRepository implements BoardRepository {
  private readonly boards = new Map<string, Board>();

  /** Las tareas y personas se usan para los recuentos y el borrado en cascada. */
  constructor(
    private readonly people?: InMemoryPeople,
    private readonly tasks?: InMemoryTaskRepository,
  ) {}

  async findByAccessCodeHash(hash: Uint8Array): Promise<Board | null> {
    return [...this.boards.values()].find((b) => sameBytes(b.accessCodeHash, hash)) ?? null;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) ?? null;
  }

  async count(): Promise<number> {
    return this.boards.size;
  }

  async insert(board: Board): Promise<'inserted' | 'id_taken'> {
    if (this.boards.has(board.id)) return 'id_taken';
    this.boards.set(board.id, board);
    return 'inserted';
  }

  async rename(id: string, name: string, updatedAt: Date): Promise<boolean> {
    const board = this.boards.get(id);
    if (!board) return false;
    this.boards.set(id, { ...board, name, updatedAt });
    return true;
  }

  async updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void> {
    const board = this.boards.get(boardId);
    if (board) {
      this.boards.set(boardId, { ...board, accessCodeHash: hash, accessCodeRotatedAt: rotatedAt, updatedAt: rotatedAt });
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!this.boards.delete(id)) return false;
    this.tasks?.deleteBoard(id);
    this.people?.deleteBoard(id);
    return true;
  }

  async getStats(id: string): Promise<BoardStats> {
    return {
      taskCount: (await this.tasks?.list(id, {}))?.length ?? 0,
      personCount: (await this.people?.listWithAssignedCount(id))?.length ?? 0,
    };
  }

  async listSummaries(): Promise<BoardSummary[]> {
    const boards = [...this.boards.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.all(
      boards.map(async (b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        ...(await this.getStats(b.id)),
        lastActivityAt: new Date(
          Math.max(b.updatedAt.getTime(), ...(this.tasks?.activityOf(b.id) ?? []), ...(this.people?.activityOf(b.id) ?? [])),
        ),
      })),
    );
  }
}

// --- Tareas y personas (US1) ---------------------------------------------------------------

export class InMemoryPeople implements PersonRepository {
  private readonly people = new Map<string, Person>();
  private tasks: InMemoryTaskRepository | null = null;
  private next = 1;

  /** El repositorio de tareas se registra para contar y desasignar (ON DELETE SET NULL). */
  attachTasks(tasks: InMemoryTaskRepository): void {
    this.tasks = tasks;
  }

  /** Atajo de prueba: añade una persona y devuelve su id. */
  add(boardId: string, name: string): string {
    const id = `c0000000-0000-4000-8000-${String(this.next++).padStart(12, '0')}`;
    this.people.set(id, { id, boardId, name, createdAt: new Date(0) });
    return id;
  }

  async existsInBoard(boardId: string, personId: string): Promise<boolean> {
    return this.people.get(personId)?.boardId === boardId;
  }

  deleteBoard(boardId: string): void {
    for (const [id, p] of this.people) if (p.boardId === boardId) this.people.delete(id);
  }

  /** Marcas de tiempo de actividad del tablero (research R24). */
  activityOf(boardId: string): number[] {
    return [...this.people.values()].filter((p) => p.boardId === boardId).map((p) => p.createdAt.getTime());
  }

  nameOf(personId: string): string | undefined {
    return this.people.get(personId)?.name;
  }

  async insert(person: Person): Promise<'inserted' | 'id_taken' | 'name_taken'> {
    if (this.people.has(person.id)) return 'id_taken';
    if (await this.findByNameKey(person.boardId, personNameKey(person.name))) return 'name_taken';
    this.people.set(person.id, person);
    return 'inserted';
  }

  async findById(boardId: string, id: string): Promise<Person | null> {
    const person = this.people.get(id);
    return person && person.boardId === boardId ? person : null;
  }

  async findByNameKey(boardId: string, key: string): Promise<Person | null> {
    return (
      [...this.people.values()].find((p) => p.boardId === boardId && personNameKey(p.name) === key) ?? null
    );
  }

  async listWithAssignedCount(boardId: string): Promise<PersonWithCount[]> {
    return [...this.people.values()]
      .filter((p) => p.boardId === boardId)
      .sort((a, b) => personNameKey(a.name).localeCompare(personNameKey(b.name)))
      .map((p) => ({ ...p, assignedTaskCount: this.tasks?.countAssignedTo(p.id) ?? 0 }));
  }

  async delete(boardId: string, id: string): Promise<{ unassignedTaskCount: number } | null> {
    if (!(await this.findById(boardId, id))) return null;
    const unassignedTaskCount = this.tasks?.countAssignedTo(id) ?? 0;
    this.tasks?.unassign(id);
    this.people.delete(id);
    return { unassignedTaskCount };
  }
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly deletedAt = new Map<string, Date>();

  constructor(private readonly people: InMemoryPeople) {
    people.attachTasks(this);
  }

  countAssignedTo(personId: string): number {
    return [...this.tasks.values()].filter((t) => t.assigneeId === personId && !this.deletedAt.has(t.id))
      .length;
  }

  unassign(personId: string): void {
    for (const [id, task] of this.tasks) {
      if (task.assigneeId === personId) this.tasks.set(id, { ...task, assigneeId: null });
    }
  }

  deleteBoard(boardId: string): void {
    for (const [id, t] of this.tasks) {
      if (t.boardId === boardId) {
        this.tasks.delete(id);
        this.deletedAt.delete(id);
      }
    }
  }

  /** Marcas de tiempo de actividad del tablero, incluidas las tareas borradas (research R24). */
  activityOf(boardId: string): number[] {
    return [...this.tasks.values()]
      .filter((t) => t.boardId === boardId)
      .flatMap((t) => [t.updatedAt.getTime(), this.deletedAt.get(t.id)?.getTime() ?? 0]);
  }

  async insert(task: Task): Promise<'inserted' | 'id_taken'> {
    if (this.tasks.has(task.id)) return 'id_taken';
    this.tasks.set(task.id, task);
    return 'inserted';
  }

  async findById(boardId: string, id: string): Promise<TaskView | null> {
    const task = this.tasks.get(id);
    return task && task.boardId === boardId && !this.deletedAt.has(id) ? this.view(task) : null;
  }

  async list(boardId: string, criteria: TaskCriteria): Promise<TaskView[]> {
    return [...this.tasks.values()]
      .filter((t) => t.boardId === boardId && !this.deletedAt.has(t.id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((t) => this.view(t))
      .filter((t) => matchesCriteria(t, criteria));
  }

  async update(task: Task): Promise<TaskView | null> {
    const current = this.tasks.get(task.id);
    if (!current || current.boardId !== task.boardId || this.deletedAt.has(task.id)) return null;
    this.tasks.set(task.id, { ...task });
    return this.view(task);
  }

  async softDelete(boardId: string, id: string, deletedAt: Date): Promise<boolean> {
    if (!(await this.findById(boardId, id))) return false;
    this.deletedAt.set(id, deletedAt);
    return true;
  }

  async findDeletedById(boardId: string, id: string): Promise<{ task: TaskView; deletedAt: Date } | null> {
    const task = this.tasks.get(id);
    const deletedAt = this.deletedAt.get(id);
    return task && deletedAt && task.boardId === boardId ? { task: this.view(task), deletedAt } : null;
  }

  async restore(boardId: string, id: string): Promise<TaskView | null> {
    if (!(await this.findDeletedById(boardId, id))) return null;
    this.deletedAt.delete(id);
    return this.findById(boardId, id);
  }

  async purgeDeletedBefore(date: Date): Promise<number> {
    let purged = 0;
    for (const [id, deletedAt] of this.deletedAt) {
      if (deletedAt < date) {
        this.deletedAt.delete(id);
        this.tasks.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  count(): number {
    return this.tasks.size;
  }

  /** Atajo de prueba hasta que exista el cambio de estado (US2). */
  forceStatus(id: string, status: TaskStatus): void {
    const task = this.tasks.get(id);
    if (task) this.tasks.set(id, { ...task, status });
  }

  private view(task: Task): TaskView {
    const name = task.assigneeId ? this.people.nameOf(task.assigneeId) : undefined;
    return { ...task, assignee: task.assigneeId && name ? { id: task.assigneeId, name } : null };
  }
}
