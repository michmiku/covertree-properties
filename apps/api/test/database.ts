import type { Prisma } from '../src/__generated__/prisma/client.ts';
import { createPrismaClient } from '../src/db.ts';
import { weatherstackFixture } from './weatherstack.ts';
import { TEST_DATABASE_URL } from './test-database-url.ts';

/** Prisma client for integration tests, bound to postgres-test. */
export const testPrisma = createPrismaClient(TEST_DATABASE_URL);

/** Empties every table; call in `beforeEach` so tests don't see each other's rows. */
export async function resetTables(): Promise<void> {
  await testPrisma.$executeRaw`TRUNCATE TABLE "properties"`;
}

let seeded = 0;

/**
 * Inserts a complete property directly (no Weatherstack), with the recorded fixture as weather.
 * Each call gets a distinct street so the S5.4 unique key never collides.
 */
export async function seedProperty(overrides: Partial<Prisma.PropertyCreateInput> = {}) {
  seeded += 1;
  return testPrisma.property.create({
    data: {
      street: `${seeded} Test St`,
      city: 'Fountain Hills',
      state: 'AZ',
      zipCode: '85268',
      lat: 33.609,
      long: -111.729,
      weatherData: weatherstackFixture.current,
      ...overrides,
    },
  });
}
