import {
  CreatePersonRequestSchema,
  DeletePersonResponseSchema,
  ListPeopleResponseSchema,
  PersonIdParamsSchema,
  PersonSchema,
  ProblemSchema,
  type PersonDto,
} from '@taskflow/contracts';
import { createPerson, deletePerson, listPeople, type PeopleDeps, type PersonWithCount } from '@taskflow/domain';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { currentBoard } from '../plugins/auth';
import { DomainFailure } from '../problem';

const toPersonDto = (p: PersonWithCount): PersonDto => ({
  id: p.id,
  name: p.name,
  assignedTaskCount: p.assignedTaskCount,
});

export const peopleRoutes: FastifyPluginAsyncZod<{ deps: PeopleDeps }> = async (app, { deps }) => {
  app.get('/people', { schema: { response: { 200: ListPeopleResponseSchema } } }, async (request) => ({
    items: (await listPeople(deps, currentBoard(request).id)).map(toPersonDto),
  }));

  app.post(
    '/people',
    {
      schema: {
        body: CreatePersonRequestSchema,
        response: { 200: PersonSchema, 201: PersonSchema, '4xx': ProblemSchema },
      },
    },
    async (request, reply) => {
      const result = await createPerson(deps, currentBoard(request).id, request.body);
      if (!result.ok) throw new DomainFailure(result.error);
      return reply.code(result.value.replayed ? 200 : 201).send(toPersonDto(result.value.person));
    },
  );

  app.delete(
    '/people/:personId',
    { schema: { params: PersonIdParamsSchema, response: { 200: DeletePersonResponseSchema } } },
    async (request) => {
      const result = await deletePerson(deps, currentBoard(request).id, request.params.personId);
      if (!result.ok) throw new DomainFailure(result.error);
      return result.value;
    },
  );
};
