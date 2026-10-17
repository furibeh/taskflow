import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { parse } from 'yaml';
import { expect } from 'vitest';

// El contrato vigente vive junto a la especificación de la última feature (002, research R25).
const CONTRACT_PATH = fileURLToPath(
  new URL('../../../../specs/002-multiple-boards/contracts/openapi.yaml', import.meta.url),
);

type Json = Record<string, unknown>;

const doc = parse(readFileSync(CONTRACT_PATH, 'utf8')) as Json;
const ajv = new Ajv2020({ strict: false, allErrors: true });
const addFormats = addFormatsModule as unknown as (a: Ajv2020) => void;
addFormats(ajv);
ajv.addSchema(doc, 'openapi');

const escape = (segment: string): string => segment.replace(/~/g, '~0').replace(/\//g, '~1');

const at = (pointer: string): Json =>
  pointer
    .replace(/^#\//, '')
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<Json>((node, key) => node[key] as Json, doc);

const findOperation = (operationId: string): string => {
  const paths = doc.paths as Record<string, Record<string, Json>>;
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (op && typeof op === 'object' && op.operationId === operationId) {
        return `#/paths/${escape(path)}/${method}`;
      }
    }
  }
  throw new Error(`operationId desconocido en el contrato: ${operationId}`);
};

/** Valida el cuerpo de una respuesta contra el esquema del contrato para ese estado. */
export const expectMatchesContract = (operationId: string, status: number, body: unknown): void => {
  const opPointer = findOperation(operationId);
  let responsePointer = `${opPointer}/responses/${status}`;
  const response = at(responsePointer);
  if (!response) throw new Error(`${operationId} no declara la respuesta ${status}`);
  if (typeof response.$ref === 'string') responsePointer = response.$ref;

  const content = at(responsePointer).content as Json | undefined;
  if (!content) {
    expect(body === undefined || body === '' || body === null).toBe(true);
    return;
  }
  const mediaType = 'application/json' in content ? 'application/json' : 'application/problem+json';
  const validate = ajv.compile({
    $ref: `openapi${responsePointer}/content/${escape(mediaType)}/schema`,
  });
  const valid = validate(body);
  expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
};
