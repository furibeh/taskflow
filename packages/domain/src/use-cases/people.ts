import { parsePersonName, personNameKey, type PersonRepository, type PersonWithCount } from '../people/person';
import type { Clock } from '../shared/clock';
import { validationError, type DomainError } from '../shared/errors';
import { err, ok, type Result } from '../shared/result';

export interface PeopleDeps {
  readonly people: PersonRepository;
  readonly clock: Clock;
}

const withCount = async (deps: Pick<PeopleDeps, 'people'>, boardId: string, id: string) =>
  (await deps.people.listWithAssignedCount(boardId)).find((p) => p.id === id);

/** Añade una persona al equipo (FR-016, FR-016a). Idempotente por id (R10). */
export const createPerson = async (
  deps: PeopleDeps,
  boardId: string,
  input: { readonly id: string; readonly name: string },
): Promise<Result<{ person: PersonWithCount; replayed: boolean }, DomainError>> => {
  const name = parsePersonName(input.name);
  if (!name.ok) return err(validationError(name.error));

  const existing = await deps.people.findById(boardId, input.id);
  if (existing) {
    if (existing.name !== name.value) return err({ code: 'ID_CONFLICT' });
    const person = await withCount(deps, boardId, existing.id);
    return person ? ok({ person, replayed: true }) : err({ code: 'PERSON_NOT_FOUND' });
  }
  if (await deps.people.findByNameKey(boardId, personNameKey(name.value))) {
    return err({ code: 'PERSON_NAME_TAKEN' });
  }

  const outcome = await deps.people.insert({
    id: input.id,
    boardId,
    name: name.value,
    createdAt: deps.clock.now(),
  });
  if (outcome === 'id_taken') return err({ code: 'ID_CONFLICT' });
  if (outcome === 'name_taken') return err({ code: 'PERSON_NAME_TAKEN' });

  return ok({
    person: { id: input.id, boardId, name: name.value, createdAt: deps.clock.now(), assignedTaskCount: 0 },
    replayed: false,
  });
};

export const listPeople = (deps: Pick<PeopleDeps, 'people'>, boardId: string): Promise<PersonWithCount[]> =>
  deps.people.listWithAssignedCount(boardId);

/** Quita a una persona; sus tareas quedan sin asignar (FR-016b). */
export const deletePerson = async (
  deps: Pick<PeopleDeps, 'people'>,
  boardId: string,
  id: string,
): Promise<Result<{ id: string; unassignedTaskCount: number }, DomainError>> => {
  const result = await deps.people.delete(boardId, id);
  return result ? ok({ id, unassignedTaskCount: result.unassignedTaskCount }) : err({ code: 'PERSON_NOT_FOUND' });
};
