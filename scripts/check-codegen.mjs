// Codegen drift check: regenerate the committed GraphQL types and fail if anything changed.
// Catches a schema.graphql or query-document edit that was committed without `pnpm codegen`.
// (The Prisma client stays gitignored; `pnpm --filter api db:drift` checks schema vs migrations.)
import { execFileSync } from 'node:child_process';

const GENERATED = ['apps/api/src/__generated__/resolvers-types.ts', 'apps/web/src/gql'];

execFileSync('pnpm', ['run', 'codegen'], { stdio: 'inherit' });

// Compare the working tree with the index, so staged-but-uncommitted codegen output counts as current.
const git = (...args) => execFileSync('git', [...args, '--', ...GENERATED], { encoding: 'utf8' });
const status = git('diff', '--name-status') + git('ls-files', '--others', '--exclude-standard');
if (status.trim()) {
  console.error(`\nGenerated GraphQL types are out of date:\n${status}`);
  console.error('\nRun `pnpm codegen` and commit the result.');
  process.exit(1);
}
console.info('Generated GraphQL types match the schema and documents.');
