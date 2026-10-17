import type { ValidationIssue } from '../shared/errors';
import { PERSON_NAME_MAX, PERSON_NAME_MIN } from '../shared/limits';
import { err, ok, type Result } from '../shared/result';
import { checkLength, normalizeText } from '../shared/text';
import type { PersonLookup } from './person-lookup';

export interface Person {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly createdAt: Date;
}

export interface PersonWithCount extends Person {
  /** Tareas no borradas asignadas (para la confirmación de FR-016b). */
  readonly assignedTaskCount: number;
}

/** Nombre de 1–50 caracteres tras normalizar (FR-016a). */
export const parsePersonName = (raw: string): Result<string, ValidationIssue> => {
  const name = normalizeText(raw);
  const issue = checkLength(name, { min: PERSON_NAME_MIN, max: PERSON_NAME_MAX });
  return issue ? err({ field: 'name', ...issue }) : ok(name);
};

/** Clave de unicidad: sin distinguir mayúsculas (igual que `lower(name)` en PostgreSQL). */
export const personNameKey = (name: string): string => name.toLowerCase();

export interface PersonRepository extends PersonLookup {
  insert(person: Person): Promise<'inserted' | 'id_taken' | 'name_taken'>;
  findById(boardId: string, id: string): Promise<Person | null>;
  findByNameKey(boardId: string, key: string): Promise<Person | null>;
  /** Personas del tablero ordenadas por nombre, con su número de tareas asignadas. */
  listWithAssignedCount(boardId: string): Promise<PersonWithCount[]>;
  /** Quita a la persona; sus tareas quedan sin asignar. null si no existe en el tablero. */
  delete(boardId: string, id: string): Promise<{ unassignedTaskCount: number } | null>;
}
