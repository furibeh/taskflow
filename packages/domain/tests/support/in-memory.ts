import type { AccessCodeService, Board, BoardRepository } from '../../src/board/board';
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

  async findByAccessCodeHash(hash: Uint8Array): Promise<Board | null> {
    return [...this.boards.values()].find((b) => sameBytes(b.accessCodeHash, hash)) ?? null;
  }

  async findAny(): Promise<Board | null> {
    return this.boards.values().next().value ?? null;
  }

  async insert(board: Board): Promise<void> {
    this.boards.set(board.id, board);
  }

  async updateAccessCodeHash(boardId: string, hash: Uint8Array, rotatedAt: Date): Promise<void> {
    const board = this.boards.get(boardId);
    if (board) this.boards.set(boardId, { ...board, accessCodeHash: hash, accessCodeRotatedAt: rotatedAt });
  }

  count(): number {
    return this.boards.size;
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

  constructor(private readonly people: InMemoryPeople) {
    people.attachTasks(this);
  }

  countAssignedTo(personId: string): number {
    return [...this.tasks.values()].filter((t) => t.assigneeId === personId).length;
  }

  unassign(personId: string): void {
    for (const [id, task] of this.tasks) {
      if (task.assigneeId === personId) this.tasks.set(id, { ...task, assigneeId: null });
    }
  }

  async insert(task: Task): Promise<'inserted' | 'id_taken'> {
    if (this.tasks.has(task.id)) return 'id_taken';
    this.tasks.set(task.id, task);
    return 'inserted';
  }

  async findById(boardId: string, id: string): Promise<TaskView | null> {
    const task = this.tasks.get(id);
    return task && task.boardId === boardId ? this.view(task) : null;
  }

  async list(boardId: string, criteria: TaskCriteria): Promise<TaskView[]> {
    return [...this.tasks.values()]
      .filter((t) => t.boardId === boardId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((t) => this.view(t))
      .filter((t) => matchesCriteria(t, criteria));
  }

  async update(task: Task): Promise<TaskView | null> {
    const current = this.tasks.get(task.id);
    if (!current || current.boardId !== task.boardId) return null;
    this.tasks.set(task.id, { ...task });
    return this.view(task);
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
