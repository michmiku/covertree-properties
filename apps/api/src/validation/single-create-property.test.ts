import { describe, expect, it, vi } from 'vitest';
import { executeOperation } from '../../test/graphql.ts';
import { createApp } from '../app.ts';
import { SINGLE_CREATE_MESSAGE } from './single-create-property.ts';

const INPUT = '{ street: "1 Main St", city: "Fountain Hills", state: AZ, zipCode: "85268" }';
const PAYLOAD = '{ __typename }';

function setup() {
  const createProperty = vi.fn().mockResolvedValue({
    kind: 'invalidInput',
    fieldErrors: [{ field: 'street', message: 'x' }],
  });
  const app = createApp({
    services: {
      createProperty,
      deleteProperty: vi.fn().mockResolvedValue({ kind: 'notFound', id: 'x' }),
      getProperty: vi.fn(),
      listProperties: vi.fn(),
    },
  });
  return { app, createProperty };
}

describe('S5.9 one createProperty per request', () => {
  it.each([
    [
      'aliases',
      `mutation { a: createProperty(input: ${INPUT}) ${PAYLOAD} b: createProperty(input: ${INPUT}) ${PAYLOAD} }`,
    ],
    [
      'a named fragment',
      `mutation { a: createProperty(input: ${INPUT}) ${PAYLOAD} ...More }
       fragment More on Mutation { b: createProperty(input: ${INPUT}) ${PAYLOAD} }`,
    ],
    [
      'an inline fragment',
      `mutation { a: createProperty(input: ${INPUT}) ${PAYLOAD} ... on Mutation { b: createProperty(input: ${INPUT}) ${PAYLOAD} } }`,
    ],
  ])('S5.9 rejects two creates via %s before calling the service', async (_, query) => {
    const { app, createProperty } = setup();

    const { body } = await executeOperation(app, query);

    expect(body.data).toBeUndefined();
    expect(body.errors?.map((e) => e.message)).toEqual([SINGLE_CREATE_MESSAGE]);
    expect(createProperty).not.toHaveBeenCalled();
  });

  it('S5.9 allows a single create alongside other mutations', async () => {
    const { app, createProperty } = setup();

    const { body } = await executeOperation(
      app,
      `mutation { createProperty(input: ${INPUT}) ${PAYLOAD} deleteProperty(id: "x") { __typename } }`,
    );

    expect(body.errors).toBeUndefined();
    expect(createProperty).toHaveBeenCalledTimes(1);
  });
});
