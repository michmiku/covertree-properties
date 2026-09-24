import { createPrismaClient } from '../src/db.ts';
import { TEST_DATABASE_URL } from './test-database-url.ts';

/** Prisma client for integration tests, bound to postgres-test. */
export const testPrisma = createPrismaClient(TEST_DATABASE_URL);

/** Empties every table; call in `beforeEach` so tests don't see each other's rows. */
export async function resetTables(): Promise<void> {
  await testPrisma.$executeRaw`TRUNCATE TABLE "properties"`;
}
