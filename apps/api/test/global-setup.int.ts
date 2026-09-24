import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database-url.ts';

/** Applies pending migrations to postgres-test once per integration run (never drops data). */
export function setup(): void {
  const url = TEST_DATABASE_URL;
  if (!url.includes(':5433/')) throw new Error(`Refusing to migrate a non-test database: ${url}`);
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
