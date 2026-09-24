#!/usr/bin/env node
// PostToolUse(Edit|Write): prettier + eslint --fix on the edited file; remaining lint errors go
// back to Claude (exit 2) so it fixes them in the same turn.
import path from 'node:path';
import { feedback, hasBin, projectDir, readInput, run } from './lib.mjs';

const FORMAT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|md|css|graphql|ya?ml)$/;
const LINT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /(^|\/)(node_modules|dist|__generated__|gql|ai\/sessions)\//;

const input = await readInput();
const file = input.tool_input?.file_path;
const root = projectDir(input);
if (!file) process.exit(0);
const rel = path.relative(root, path.resolve(root, file));
if (rel.startsWith('..') || SKIP.test(rel) || !FORMAT.test(rel)) process.exit(0);
if (!hasBin(root, 'prettier')) process.exit(0); // tooling not installed yet

const fmt = run(
  'pnpm',
  ['exec', 'prettier', '--write', '--ignore-unknown', '--log-level', 'warn', rel],
  root,
);
if (!fmt.ok) feedback(`prettier failed on ${rel} (likely a syntax error):\n${fmt.output}`);

if (LINT.test(rel) && hasBin(root, 'eslint')) {
  const lint = run('pnpm', ['exec', 'eslint', '--fix', '--no-warn-ignored', rel], root);
  if (!lint.ok)
    feedback(`eslint found problems in ${rel} that --fix could not resolve:\n${lint.output}`);
}
