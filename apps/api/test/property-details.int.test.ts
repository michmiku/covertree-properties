import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createServices } from '../src/container.ts';
import { readEnv } from '../src/env.ts';
import { resetTables, seedProperty, testPrisma } from './database.ts';
import { executeOperation } from './graphql.ts';
import { recordOutboundRequests } from './msw.ts';
import { weatherstackFixture } from './weatherstack.ts';

// Production wiring (container.ts), so S4.3 also covers what server.ts builds.
const app = createApp({ services: createServices(readEnv(), testPrisma) });

const DETAILS = /* GraphQL */ `
  query Details($id: ID!) {
    property(id: $id) {
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
      }
    }
  }
`;

const details = (id: string) =>
  executeOperation<{ property: Record<string, unknown> | null }>(app, DETAILS, { id });

describe('property query (GraphQL → Postgres)', () => {
  beforeEach(resetTables);
  afterAll(() => testPrisma.$disconnect());

  it('S4.1 returns the property with every S7 field including weather', async () => {
    const seeded = await seedProperty({ street: '15528 E Golden Eagle Blvd' });
    await seedProperty();

    const { body } = await details(seeded.id);

    expect(body).toEqual({
      data: {
        property: {
          id: seeded.id,
          street: '15528 E Golden Eagle Blvd',
          city: 'Fountain Hills',
          state: 'AZ',
          zipCode: '85268',
          lat: 33.609,
          long: -111.729,
          createdAt: seeded.createdAt.toISOString(),
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
          },
        },
      },
    });
  });

  it('S4.2 returns null, not an error, for an unknown id', async () => {
    await seedProperty();

    const { body } = await details('00000000-0000-4000-8000-000000000000');

    expect(body).toEqual({ data: { property: null } });
  });

  it.each(['not-a-uuid', '', '1', "' OR 1=1 --"])(
    'S4.2 returns null, not an error, for the malformed id %j',
    async (id) => {
      const { body } = await details(id);

      expect(body).toEqual({ data: { property: null } });
    },
  );

  it('S4.4 returns weather descriptions trimmed', async () => {
    const seeded = await seedProperty({
      weatherData: { ...weatherstackFixture.current, weather_descriptions: ['  Partly cloudy '] },
    });

    const { body } = await details(seeded.id);

    expect(body.data?.property).toMatchObject({
      weatherData: { weatherDescriptions: ['Partly cloudy'] },
    });
  });

  it('S4.3 makes no Weatherstack request when reading details', async () => {
    const outbound = recordOutboundRequests();
    const seeded = await seedProperty();

    const { body } = await details(seeded.id);

    expect(body.data?.property).toMatchObject({ id: seeded.id });
    expect(outbound).toEqual([]);
  });
});
