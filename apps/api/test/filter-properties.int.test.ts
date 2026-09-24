import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createServices } from '../src/container.ts';
import { readEnv } from '../src/env.ts';
import { resetTables, seedProperty, testPrisma } from './database.ts';
import { executeOperation } from './graphql.ts';

const app = createApp({ services: createServices(readEnv(), testPrisma) });

const LIST = /* GraphQL */ `
  query Filter($filter: PropertyFilter, $orderBy: PropertyOrderBy) {
    properties(filter: $filter, orderBy: $orderBy) {
      street
    }
  }
`;

async function streets(filter: Record<string, unknown> | null, orderBy?: Record<string, unknown>) {
  const { body } = await executeOperation<{ properties: { street: string }[] }>(app, LIST, {
    filter,
    orderBy,
  });
  expect(body.errors).toBeUndefined();
  return body.data!.properties.map((p) => p.street).sort();
}

describe('properties(filter) (GraphQL → Postgres)', () => {
  beforeEach(async () => {
    await resetTables();
    await seedProperty({ street: 'FH1', city: 'Fountain Hills', state: 'AZ', zipCode: '85268' });
    await seedProperty({ street: 'FH2', city: 'Fountain Hills', state: 'AZ', zipCode: '85269' });
    await seedProperty({ street: 'SC', city: 'Scottsdale', state: 'AZ', zipCode: '85250' });
    await seedProperty({ street: 'SJ', city: 'San Juan', state: 'PR', zipCode: '00901' });
    await seedProperty({ street: 'US', city: 'Under_Score', state: 'TX', zipCode: '75001' });
  });
  afterAll(() => testPrisma.$disconnect());

  it('S3.1 ANDs the provided fields', async () => {
    expect(await streets({ city: 'hills', zipCode: '85268' })).toEqual(['FH1']);
    expect(await streets({ city: 'hills', state: 'PR' })).toEqual([]);
    expect(await streets({ state: 'AZ' })).toEqual(['FH1', 'FH2', 'SC']);
  });

  it.each(['fountain', 'HILLS', '  Fountain Hills  ', 'tain hi'])(
    'S3.2 matches city %j as a case-insensitive substring',
    async (city) => {
      expect(await streets({ city })).toEqual(['FH1', 'FH2']);
    },
  );

  it.each([
    ['Fo%', []],
    ['n_H', []],
    ['%', []],
    ['_', ['US']],
    ['r_s', ['US']],
  ])('S3.3 treats %j literally, not as a LIKE wildcard', async (city, expected) => {
    expect(await streets({ city })).toEqual(expected);
  });

  it.each([{ city: '' }, { city: '   ' }, { zipCode: '' }, { zipCode: '  ' }])(
    'S3.4 applies no constraint for blank %j',
    async (filter) => {
      expect(await streets(filter)).toHaveLength(5);
    },
  );

  it('S3.5 matches zip code exactly, not as a prefix', async () => {
    expect(await streets({ zipCode: '85268' })).toEqual(['FH1']);
    expect(await streets({ zipCode: ' 85268 ' })).toEqual(['FH1']);
    expect(await streets({ zipCode: '00901' })).toEqual(['SJ']);
  });

  it.each(['85A68', '8526', '852681', '85268-1234'])(
    'S3.6 rejects zip code filter %j with BAD_USER_INPUT, not an empty list',
    async (zipCode) => {
      const { body } = await executeOperation(app, LIST, { filter: { zipCode } });

      expect(body.data).toBeNull();
      expect(body.errors?.[0]).toMatchObject({
        message: 'Zip code filter must be exactly 5 digits.',
        extensions: { code: 'BAD_USER_INPUT' },
      });
    },
  );

  it('S3.3 treats a backslash literally too', async () => {
    await seedProperty({ street: 'BS', city: 'Back\\slash' });

    expect(await streets({ city: 'k\\s' })).toEqual(['BS']);
    expect(await streets({ city: '\\' })).toEqual(['BS']);
  });

  it.each(['XX', 'az'])('S3.7 rejects state %j through GraphQL validation', async (state) => {
    const { body } = await executeOperation(app, LIST, { filter: { state } });

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.message).toContain('USState');
  });

  it('S3.7 matches state exactly', async () => {
    expect(await streets({ state: 'PR' })).toEqual(['SJ']);
  });

  it('S3.8 sorts the filtered set', async () => {
    await resetTables();
    await seedProperty({ street: 'old', city: 'Mesa', createdAt: new Date('2026-01-01Z') });
    await seedProperty({ street: 'other', city: 'Tempe', createdAt: new Date('2026-01-02Z') });
    await seedProperty({ street: 'new', city: 'Mesa', createdAt: new Date('2026-01-03Z') });

    const ordered = async (createdAt: string) =>
      (
        await executeOperation<{ properties: { street: string }[] }>(app, LIST, {
          filter: { city: 'mesa' },
          orderBy: { createdAt },
        })
      ).body.data!.properties.map((p) => p.street);

    expect(await ordered('ASC')).toEqual(['old', 'new']);
    expect(await ordered('DESC')).toEqual(['new', 'old']);
  });

  it.each([null, {}, { city: null, zipCode: null, state: null }])(
    'S3.9 returns the same list, in the same order, as an unfiltered query for filter %j',
    async (filter) => {
      const inOrder = async (variables: Record<string, unknown>) =>
        (
          await executeOperation<{ properties: { street: string }[] }>(app, LIST, variables)
        ).body.data!.properties.map((p) => p.street);

      const unfiltered = await inOrder({});

      expect(unfiltered).toHaveLength(5);
      expect(await inOrder({ filter })).toEqual(unfiltered);
    },
  );

  it('S3.10 returns an empty list when nothing matches', async () => {
    expect(await streets({ city: 'Phoenix' })).toEqual([]);
  });
});
