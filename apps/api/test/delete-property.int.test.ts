import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createServices } from '../src/container.ts';
import { readEnv } from '../src/env.ts';
import { resetTables, seedProperty, testPrisma } from './database.ts';
import { executeOperation } from './graphql.ts';
import { recordOutboundRequests, server } from './msw.ts';
import { weatherstack } from './weatherstack.ts';

// Production wiring (container.ts), so S6.5 also covers what server.ts builds.
const app = createApp({ services: createServices(readEnv(), testPrisma) });

const DELETE = /* GraphQL */ `
  mutation Delete($id: ID!) {
    deleteProperty(id: $id) {
      __typename
      ... on DeletePropertySuccess {
        id
      }
      ... on PropertyNotFoundError {
        message
        id
      }
    }
  }
`;

const CREATE = /* GraphQL */ `
  mutation Create($input: CreatePropertyInput!) {
    createProperty(input: $input) {
      __typename
    }
  }
`;

const remove = (id: string) =>
  executeOperation<{ deleteProperty: Record<string, unknown> }>(app, DELETE, { id });

const rowCount = () => testPrisma.property.count();

describe('deleteProperty mutation (GraphQL → Postgres)', () => {
  beforeEach(resetTables);
  afterAll(() => testPrisma.$disconnect());

  it('S6.1 removes the property and returns DeletePropertySuccess with its id', async () => {
    const target = await seedProperty();
    const other = await seedProperty();

    const { body } = await remove(target.id);

    expect(body).toEqual({
      data: { deleteProperty: { __typename: 'DeletePropertySuccess', id: target.id } },
    });
    expect(await testPrisma.property.findMany({ select: { id: true } })).toEqual([
      { id: other.id },
    ]);
  });

  it('S6.1 returns the stored id when the request used an uppercase UUID', async () => {
    const target = await seedProperty();

    const { body } = await remove(target.id.toUpperCase());

    expect(body.data?.deleteProperty).toEqual({
      __typename: 'DeletePropertySuccess',
      id: target.id,
    });
  });

  it.each(['00000000-0000-4000-8000-000000000000', 'not-a-uuid', ''])(
    'S6.2 returns PropertyNotFoundError in data and changes no rows for the id %j',
    async (id) => {
      await seedProperty();

      const { body } = await remove(id);

      expect(body.errors).toBeUndefined();
      expect(body.data?.deleteProperty).toEqual({
        __typename: 'PropertyNotFoundError',
        message: 'Property not found.',
        id,
      });
      expect(await rowCount()).toBe(1);
    },
  );

  it('S6.3 succeeds the first time and returns PropertyNotFoundError the second', async () => {
    const target = await seedProperty();

    const first = await remove(target.id);
    const second = await remove(target.id);

    expect(first.body.data?.deleteProperty).toMatchObject({ __typename: 'DeletePropertySuccess' });
    expect(second.body.data?.deleteProperty).toMatchObject({
      __typename: 'PropertyNotFoundError',
      id: target.id,
    });
  });

  it('S6.4 allows the same address to be created again after a delete', async () => {
    const address = {
      street: '15528 E Golden Eagle Blvd',
      city: 'Fountain Hills',
      state: 'AZ',
      zipCode: '85268',
    } as const;
    const existing = await seedProperty(address);
    server.use(weatherstack.ok());

    const before = await executeOperation(app, CREATE, { input: address });
    await remove(existing.id);
    const after = await executeOperation(app, CREATE, { input: address });

    expect(before.body.data).toEqual({ createProperty: { __typename: 'DuplicatePropertyError' } });
    expect(after.body.data).toEqual({ createProperty: { __typename: 'CreatePropertySuccess' } });
    expect(await rowCount()).toBe(1);
  });

  it('S6.5 makes no Weatherstack request while deleting', async () => {
    const outbound = recordOutboundRequests();
    const target = await seedProperty();

    const { body } = await remove(target.id);

    expect(body.data?.deleteProperty).toMatchObject({ __typename: 'DeletePropertySuccess' });
    expect(outbound).toEqual([]);
  });
});
