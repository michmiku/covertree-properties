import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTables, testPrisma } from './database.ts';

describe('database scaffold', () => {
  beforeEach(resetTables);
  afterAll(() => testPrisma.$disconnect());

  it('applies migrations to postgres-test, including pg_trgm', async () => {
    await expect(testPrisma.property.count()).resolves.toBe(0);
    const extensions = await testPrisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
    expect(extensions).toHaveLength(1);
  });
});
