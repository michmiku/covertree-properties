import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createServices } from '../src/container.ts';
import { readEnv } from '../src/env.ts';
import { createPropertyRepository } from '../src/repositories/property.repository.ts';
import { createPropertyService } from '../src/services/create-property.service.ts';
import { listPropertiesService } from '../src/services/list-properties.service.ts';
import { createWeatherstackClient } from '../src/weatherstack/client.ts';
import { resetTables, testPrisma } from './database.ts';
import { executeOperation } from './graphql.ts';
import { server } from './msw.ts';
import { TEST_ACCESS_KEY, weatherstack } from './weatherstack.ts';

const properties = createPropertyRepository(testPrisma);
const app = createApp({
  services: {
    listProperties: listPropertiesService({ properties }),
    createProperty: createPropertyService({
      properties,
      weatherstack: createWeatherstackClient({
        baseUrl: 'http://weatherstack.test',
        accessKey: TEST_ACCESS_KEY,
        timeoutMs: 100,
      }),
      logger: { warn: () => {} },
    }),
  },
});

const CREATE = /* GraphQL */ `
  mutation Create($input: CreatePropertyInput!) {
    createProperty(input: $input) {
      __typename
      ... on CreatePropertySuccess {
        property {
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
            weatherCode
            weatherDescriptions
            weatherIcons
            humidity
            windSpeed
            windDegree
            windDir
            pressure
            precip
            cloudcover
            uvIndex
            visibility
            isDay
          }
        }
      }
      ... on InvalidInputError {
        message
        fieldErrors {
          field
          message
        }
      }
      ... on DuplicatePropertyError {
        message
        existingPropertyId
      }
      ... on WeatherUnavailableError {
        message
        reason
      }
    }
  }
`;

const INPUT = {
  street: '15528 E Golden Eagle Blvd',
  city: 'Fountain Hills',
  state: 'AZ',
  zipCode: '85268',
};

/** The `createProperty` payload as selected by CREATE; union members leave the others undefined. */
interface CreatePropertyPayload {
  __typename: string;
  property: { id: string; createdAt: string; weatherData: unknown } & Record<string, unknown>;
  message: string;
  reason: string;
}

const execute = (
  query: string,
  variables: Record<string, unknown>,
  target: ReturnType<typeof createApp> = app,
) => executeOperation<{ createProperty: CreatePropertyPayload }>(target, query, variables);

const create = (input: Record<string, unknown> = INPUT) => execute(CREATE, { input });

describe('createProperty (GraphQL → Postgres)', () => {
  beforeEach(resetTables);
  afterAll(() => testPrisma.$disconnect());

  it('S5.1 creates the property with weather, lat and long from one Weatherstack call', async () => {
    const requests: URL[] = [];
    server.use(weatherstack.ok(requests));

    const { body } = await create();

    expect(requests).toHaveLength(1);
    const result = body.data!.createProperty;
    expect(result.__typename).toBe('CreatePropertySuccess');
    expect(result.property).toMatchObject({ ...INPUT, lat: 33.609, long: -111.729 });
    expect(new Date(result.property.createdAt).toISOString()).toBe(result.property.createdAt);
    expect(await testPrisma.property.count()).toBe(1);
  });

  it('S7.2 exposes every Weather field mapped from the stored Weatherstack object', async () => {
    server.use(weatherstack.ok());

    const { body } = await create();

    expect(body.data!.createProperty.property.weatherData).toEqual({
      observationTime: '10:35 AM',
      temperature: 79,
      feelsLike: 79,
      weatherCode: 122,
      weatherDescriptions: ['Overcast'],
      weatherIcons: [
        'https://cdn.worldweatheronline.com/images/wsymbols01_png_64/wsymbol_0004_black_low_cloud.png',
      ],
      humidity: 42,
      windSpeed: 6,
      windDegree: 35,
      windDir: 'NE',
      pressure: 1010,
      precip: 0,
      cloudcover: 100,
      uvIndex: 0,
      visibility: 6,
      isDay: false,
    });
  });

  it('S5.2 never returns the access key', async () => {
    server.use(weatherstack.ok());
    const ok = await create();
    server.use(weatherstack.successFalse());
    const failed = await create({ ...INPUT, zipCode: '85269' });

    expect(ok.text).not.toContain(TEST_ACCESS_KEY);
    expect(failed.text).not.toContain(TEST_ACCESS_KEY);
  });

  it('S5.3 returns InvalidInputError for a bad zip code without calling Weatherstack', async () => {
    // No handler registered: any Weatherstack request would fail the test (onUnhandledRequest).
    const { body } = await create({ ...INPUT, zipCode: '8526A' });

    expect(body.data!.createProperty).toEqual({
      __typename: 'InvalidInputError',
      message: 'Some fields are invalid.',
      fieldErrors: [{ field: 'zipCode', message: 'Zip code must be exactly 5 digits.' }],
    });
    expect(await testPrisma.property.count()).toBe(0);
  });

  it.each(['XX', 'az'])(
    'S5.3 rejects state %j through GraphQL validation, before the resolver runs',
    async (state) => {
      const { body } = await create({ ...INPUT, state });

      expect(body.data).toBeUndefined();
      expect(body.errors?.[0]?.message).toContain('USState');
    },
  );

  it.each([
    ['id', { id: 'x' }],
    ['createdAt', { createdAt: '2026-01-01T00:00:00Z' }],
    ['weatherData', { weatherData: {} }],
    ['lat', { lat: 1 }],
    ['long', { long: 2 }],
  ])('S7.1 rejects client-supplied %s', async (field, extra) => {
    const { body } = await create({ ...INPUT, ...extra });

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.message).toContain(`"${field}"`);
  });

  it('S5.4 returns DuplicatePropertyError for an existing address without calling Weatherstack', async () => {
    const requests: URL[] = [];
    server.use(weatherstack.ok(requests));
    const first = await create();

    const second = await create();

    expect(requests).toHaveLength(1);
    expect(await testPrisma.property.count()).toBe(1);

    expect(second.body.data!.createProperty).toEqual({
      __typename: 'DuplicatePropertyError',
      message: 'A property with this address already exists.',
      existingPropertyId: first.body.data!.createProperty.property.id,
    });
  });

  it('S5.4 lets only one of two concurrent identical creates succeed', async () => {
    server.use(weatherstack.ok());

    const results = await Promise.all([create(), create()]);

    const typenames = results.map((r) => r.body.data!.createProperty.__typename).sort();
    expect(typenames).toEqual(['CreatePropertySuccess', 'DuplicatePropertyError']);
    expect(await testPrisma.property.count()).toBe(1);
  });

  it.each([
    ['NETWORK', (r: URL[]) => weatherstack.networkError(r)],
    ['TIMEOUT', (r: URL[]) => weatherstack.timeout(r)],
    ['HTTP_ERROR', (r: URL[]) => weatherstack.httpError(500, r)],
    ['UPSTREAM_ERROR', (r: URL[]) => weatherstack.successFalse(r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.missingCurrent(r)],
    ['LOCATION_MISMATCH', (r: URL[]) => weatherstack.withLocation({ country: 'Mexico' }, r)],
  ])(
    'S5.5 returns WeatherUnavailableError %s after one request and persists nothing',
    async (reason, handler) => {
      const requests: URL[] = [];
      server.use(handler(requests));

      const { body } = await create();

      expect(requests).toHaveLength(1);

      expect(body.errors).toBeUndefined();
      expect(body.data!.createProperty).toMatchObject({
        __typename: 'WeatherUnavailableError',
        reason,
      });
      expect(body.data!.createProperty.message).toMatch(/not created/);
      expect(await testPrisma.property.count()).toBe(0);
    },
  );

  it('S5.7 wires WEATHERSTACK_BASE_URL and WEATHERSTACK_ACCESS_KEY from env into createProperty', async () => {
    // vitest.config.ts sets both; this goes through the same path as server.ts.
    const fromEnv = createApp({ services: createServices(readEnv(), testPrisma) });
    const requests: URL[] = [];
    server.use(weatherstack.ok(requests));

    const { body } = await execute(CREATE, { input: INPUT }, fromEnv);

    expect(body.data!.createProperty.__typename).toBe('CreatePropertySuccess');
    expect(requests.map((url) => [url.origin, url.searchParams.get('access_key')])).toEqual([
      ['http://weatherstack.test', TEST_ACCESS_KEY],
    ]);
  });
});
