import { describe, expect, it, vi } from 'vitest';
import { weatherstackFixture } from '../../test/weatherstack.ts';
import type {
  InsertResult,
  NewProperty,
  PropertyRecord,
  PropertyRepository,
} from '../repositories/property.repository.ts';
import { WeatherstackSuccess } from '../weatherstack/schema.ts';
import type { WeatherLookup, WeatherstackClient } from '../weatherstack/client.ts';
import { createPropertyService, type CreatePropertyInput } from './create-property.service.ts';

const VALID: CreatePropertyInput = {
  street: '15528 E Golden Eagle Blvd',
  city: 'Fountain Hills',
  state: 'AZ',
  zipCode: '85268',
};

const success = (location: Partial<{ country: string; region: string }> = {}): WeatherLookup => ({
  ok: true,
  response: WeatherstackSuccess.parse({
    ...weatherstackFixture,
    location: { ...weatherstackFixture.location, ...location },
  }),
  raw: weatherstackFixture,
});

/** In-memory repository with the same exact-match duplicate rule as the DB unique key. */
function fakeRepository(seed: PropertyRecord[] = []) {
  const rows = [...seed];
  const key = (a: { street: string; city: string; state: string; zipCode: string }) =>
    [a.street, a.city, a.state, a.zipCode].join('|');
  const repo: PropertyRepository = {
    findByAddress: async (address) => rows.find((row) => key(row) === key(address)) ?? null,
    insert: vi.fn(async (data: NewProperty): Promise<InsertResult> => {
      const property = {
        ...data,
        weatherData: data.weatherData as PropertyRecord['weatherData'],
        id: `id-${rows.length + 1}`,
        createdAt: new Date(),
      };
      rows.push(property);
      return { ok: true, property };
    }),
  };
  return { repo, rows };
}

function setup({
  lookup = success(),
  seed,
}: { lookup?: WeatherLookup; seed?: PropertyRecord[] } = {}) {
  const { repo, rows } = fakeRepository(seed);
  const current = vi.fn<WeatherstackClient['current']>().mockResolvedValue(lookup);
  const logger = { warn: vi.fn() };
  const create = createPropertyService({ properties: repo, weatherstack: { current }, logger });
  return { create, rows, current, logger, repo };
}

describe('createProperty service', () => {
  it('S5.1 makes exactly one Weatherstack request, then persists weather, lat and long', async () => {
    const { create, rows, current } = setup();

    const result = await create(VALID);

    expect(current).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('created');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...VALID, lat: 33.609, long: -111.729 });
    expect(rows[0]!.weatherData).toMatchObject({ temperature: 79, observation_time: '10:35 AM' });
  });

  it('S5.2 queries Weatherstack with "<zipCode>, <state>, USA"', async () => {
    const { create, current } = setup();

    await create(VALID);

    expect(current).toHaveBeenCalledWith('85268, AZ, USA');
  });

  it('S5.3 trims street and city before storing', async () => {
    const { create, rows } = setup();

    await create({ ...VALID, street: '  15528 E Golden Eagle Blvd ', city: ' Fountain Hills  ' });

    expect(rows[0]).toMatchObject({ street: VALID.street, city: VALID.city });
  });

  it.each(['8526', '852681', '85268-1234', '8526A', ''])(
    'S5.3 rejects zip code %j without calling Weatherstack',
    async (zipCode) => {
      const { create, rows, current } = setup();

      const result = await create({ ...VALID, zipCode });

      expect(result).toEqual({
        kind: 'invalidInput',
        fieldErrors: [{ field: 'zipCode', message: 'Zip code must be exactly 5 digits.' }],
      });
      expect(current).not.toHaveBeenCalled();
      expect(rows).toHaveLength(0);
    },
  );

  it('S5.3 rejects blank or too-long street and city', async () => {
    const { create, current } = setup();

    const blank = await create({ ...VALID, street: '   ', city: '' });
    const tooLong = await create({ ...VALID, street: 'x'.repeat(201), city: 'y'.repeat(101) });

    expect(blank).toMatchObject({
      kind: 'invalidInput',
      fieldErrors: [
        { field: 'street', message: 'Street is required.' },
        { field: 'city', message: 'City is required.' },
      ],
    });
    expect(tooLong).toMatchObject({
      kind: 'invalidInput',
      fieldErrors: [
        { field: 'street', message: 'Street must be at most 200 characters.' },
        { field: 'city', message: 'City must be at most 100 characters.' },
      ],
    });
    expect(current).not.toHaveBeenCalled();
  });

  it('S5.3 reports every invalid field together', async () => {
    const { create } = setup();

    const result = await create({ ...VALID, street: '', city: '', zipCode: 'abc' });

    expect(result.kind === 'invalidInput' && result.fieldErrors.map((e) => e.field)).toEqual([
      'street',
      'city',
      'zipCode',
    ]);
  });

  it('S5.4 returns the existing id for a duplicate address without calling Weatherstack', async () => {
    const { create, current, repo, rows } = setup();
    await create(VALID);
    current.mockClear();

    const second = await create({ ...VALID, street: ` ${VALID.street} ` });

    expect(second).toEqual({ kind: 'duplicate', existingPropertyId: rows[0]!.id });
    expect(current).not.toHaveBeenCalled();
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it('S5.4 treats addresses differing only in case as different properties', async () => {
    const { create, rows } = setup();

    await create(VALID);
    const result = await create({ ...VALID, street: VALID.street.toLowerCase() });

    expect(result.kind).toBe('created');
    expect(rows).toHaveLength(2);
  });

  it('S5.4 reports a duplicate when a concurrent create wins the insert', async () => {
    const { create, current, repo } = setup();
    vi.mocked(repo.insert).mockResolvedValueOnce({ ok: false, duplicateOf: 'winner-id' });

    const result = await create(VALID);

    expect(current).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'duplicate', existingPropertyId: 'winner-id' });
  });

  it.each(['NETWORK', 'TIMEOUT', 'HTTP_ERROR', 'UPSTREAM_ERROR', 'INVALID_RESPONSE'] as const)(
    'S5.5 returns %s and persists nothing when the lookup fails',
    async (reason) => {
      const { create, rows, logger } = setup({
        lookup: { ok: false, reason, detail: 'upstream detail' },
      });

      const result = await create(VALID);

      expect(result).toEqual({ kind: 'weatherUnavailable', reason });
      expect(rows).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(reason));
    },
  );

  it.each(['USA United States of America', 'United States of America'])(
    'S5.6 accepts country %j',
    async (country) => {
      const { create } = setup({ lookup: success({ country }) });

      expect((await create(VALID)).kind).toBe('created');
    },
  );

  it('S5.6 accepts a territory reported as the USA with the territory in region', async () => {
    const { create } = setup({
      lookup: success({ country: 'USA United States of America', region: 'Puerto Rico' }),
    });

    const result = await create({ ...VALID, state: 'PR', zipCode: '00901', city: 'San Juan' });

    expect(result.kind).toBe('created');
  });

  it('S5.6 returns LOCATION_MISMATCH and persists nothing when the country is not the USA', async () => {
    const { create, rows } = setup({ lookup: success({ country: 'Mexico' }) });

    const result = await create(VALID);

    expect(result).toEqual({ kind: 'weatherUnavailable', reason: 'LOCATION_MISMATCH' });
    expect(rows).toHaveLength(0);
  });
});
