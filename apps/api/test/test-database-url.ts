/** postgres-test from docker-compose.yml; never the dev database (CLAUDE.md "Tests"). */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://covertree:covertree@localhost:5433/covertree_test';
