import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createServices } from '../src/container.ts';
import { readEnv } from '../src/env.ts';
import { resetTables, seedProperty, testPrisma } from './database.ts';
import { executeOperation } from './graphql.ts';

// Production wiring (container.ts), so S1.3 also covers what server.ts builds.
const app = createApp({ services: createServices(readEnv(), testPrisma) });

const LIST = /* GraphQL */ `
  query List($orderBy: PropertyOrderBy, $filter: PropertyFilter) {
    properties(orderBy: $orderBy, filter: $filter) {
      id
      street
      city
      state
      zipCode
      lat
      long
      createdAt
      weatherData {
        observationTime
        temperature
        feelsLike
        weatherDescriptions
        weatherIcons
        humidity
        windSpeed
        windDir
        isDay
      }
    }
  }
`;

interface ListedProperty {
  id: string;
  street: string;
  createdAt: string;
  [field: string]: unknown;
}

const list = (variables: Record<string, unknown> = {}) =>
  executeOperation<{ properties: ListedProperty[] }>(app, LIST, variables);

const streets = (body: { data?: { properties: ListedProperty[] } }) =>
  body.data?.properties.map((property) => property.street);

describe('properties query (GraphQL → Postgres)', () => {
  beforeEach(resetTables);
  afterAll(() => testPrisma.$disconnect());

  it('S1.1 returns every persisted property with all S7 fields', async () => {
    const a = await seedProperty({ street: '15528 E Golden Eagle Blvd' });
    const b = await seedProperty({
      street: '1 Main St',
      city: 'San Juan',
      state: 'PR',
      zipCode: '00901',
    });

    const { body } = await list();

    expect(body.errors).toBeUndefined();
    expect(body.data?.properties).toHaveLength(2);
    expect(body.data?.properties).toContainEqual({
      id: b.id,
      street: '1 Main St',
      city: 'San Juan',
      state: 'PR',
      zipCode: '00901',
      lat: 33.609,
      long: -111.729,
      createdAt: b.createdAt.toISOString(),
      weatherData: {
        observationTime: '10:35 AM',
        temperature: 79,
        feelsLike: 79,
        weatherDescriptions: ['Overcast'],
        weatherIcons: [
          'https://cdn.worldweatheronline.com/images/wsymbols01_png_64/wsymbol_0004_black_low_cloud.png',
        ],
        humidity: 42,
        windSpeed: 6,
        windDir: 'NE',
        isDay: false,
      },
    });
    expect(body.data?.properties.map((p) => p.id)).toContain(a.id);
  });

  it('S1.2 returns an empty list, not null or an error, when there are no properties', async () => {
    const { body } = await list();

    expect(body).toEqual({ data: { properties: [] } });
  });

  it('S1.3 makes no Weatherstack request while listing', async () => {
    // No MSW handler is registered: any outbound request would fail this test (onUnhandledRequest).
    await seedProperty();

    const { body } = await list();

    expect(body.data?.properties).toHaveLength(1);
  });

  describe('sorting by creation date', () => {
    beforeEach(async () => {
      await seedProperty({ street: 'A', createdAt: new Date('2026-01-01T00:00:00Z') });
      await seedProperty({ street: 'B', createdAt: new Date('2026-01-02T00:00:00Z') });
      await seedProperty({ street: 'C', createdAt: new Date('2026-01-03T00:00:00Z') });
    });

    it('S2.1 lists newest first when orderBy is omitted', async () => {
      expect(streets((await list()).body)).toEqual(['C', 'B', 'A']);
    });

    it('S2.2 sorts ASC oldest first and DESC newest first', async () => {
      const asc = await list({ orderBy: { createdAt: 'ASC' } });
      const desc = await list({ orderBy: { createdAt: 'DESC' } });

      expect(streets(asc.body)).toEqual(['A', 'B', 'C']);
      expect(streets(desc.body)).toEqual(['C', 'B', 'A']);
    });

    it.each([{}, { createdAt: null }])('S2.1 treats orderBy %j as DESC', async (orderBy) => {
      expect(streets((await list({ orderBy })).body)).toEqual(['C', 'B', 'A']);
    });
  });

  it('S2.3 orders equal createdAt by id in the same direction, stably', async () => {
    const createdAt = new Date('2026-02-01T00:00:00Z');
    const rows = await Promise.all(
      ['X', 'Y', 'Z'].map((street) => seedProperty({ street, createdAt })),
    );
    const byId = rows.map((row) => row.id).sort();

    const asc = await list({ orderBy: { createdAt: 'ASC' } });
    const desc = await list({ orderBy: { createdAt: 'DESC' } });
    const again = await list({ orderBy: { createdAt: 'DESC' } });

    expect(asc.body.data?.properties.map((p) => p.id)).toEqual(byId);
    expect(desc.body.data?.properties.map((p) => p.id)).toEqual([...byId].reverse());
    expect(again.body).toEqual(desc.body);
  });

  // Temporary until S3: a filter is rejected rather than silently ignored.
  it.each([{ state: 'AZ' }, { city: 'Fountain' }, { zipCode: '85268' }, { zipCode: '' }])(
    'rejects filter %j with BAD_USER_INPUT until S3 implements filtering',
    async (filter) => {
      const { body } = await list({ filter });

      expect(body.data).toBeNull();
      expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    },
  );

  it('S3.4 accepts a blank city filter as no constraint', async () => {
    await seedProperty();

    const { body } = await list({ filter: { city: '   ' } });

    expect(body.data?.properties).toHaveLength(1);
  });
});
