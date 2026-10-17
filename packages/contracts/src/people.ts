import { PERSON_NAME_MAX, PERSON_NAME_MIN } from '@taskflow/domain';
import { z } from 'zod';
import { boundedText } from './text';

// Debe coincidir con components.schemas.Person de contracts/openapi.yaml.
export const PersonSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  assignedTaskCount: z.number().int().min(0),
});
export type PersonDto = z.infer<typeof PersonSchema>;

export const PersonNameSchema = boundedText({ min: PERSON_NAME_MIN, max: PERSON_NAME_MAX });

export const CreatePersonRequestSchema = z.strictObject({
  id: z.uuid(),
  name: PersonNameSchema,
});
export type CreatePersonRequest = z.infer<typeof CreatePersonRequestSchema>;

export const ListPeopleResponseSchema = z.strictObject({ items: z.array(PersonSchema) });

export const DeletePersonResponseSchema = z.strictObject({
  id: z.uuid(),
  unassignedTaskCount: z.number().int().min(0),
});
export type DeletePersonResponse = z.infer<typeof DeletePersonResponseSchema>;

export const PersonIdParamsSchema = z.strictObject({ personId: z.uuid() });
