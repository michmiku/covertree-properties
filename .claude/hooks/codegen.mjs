#!/usr/bin/env node
// PostToolUse(Edit|Write): keep generated types in sync with their sources.
//   *.graphql      -> pnpm codegen (server resolvers + client documents)
//   schema.prisma  -> prisma generate in the owning package
import { existsSync } from 'node:fs';
import path from 'node:path';
import { feedback, projectDir, readInput, run, tail } from './lib.mjs';

const input = await readInput();
const file = input.tool_input?.file_path;
const root = projectDir(input);
if (!file) process.exit(0);
const abs = path.resolve(root, file);
if (path.relative(root, abs).startsWith('..') || abs.includes(`${path.sep}node_modules${path.sep}`))
  process.exit(0);

if (abs.endsWith('.graphql')) {
  const r = run('pnpm', ['run', 'codegen'], root);
  if (!r.ok)
    feedback(`codegen failed after editing ${path.relative(root, abs)}:\n${tail(r.output, 40)}`);
} else if (path.basename(abs) === 'schema.prisma') {
  let dir = path.dirname(abs);
  while (dir.startsWith(root) && !existsSync(path.join(dir, 'package.json')))
    dir = path.dirname(dir);
  const r = run('pnpm', ['exec', 'prisma', 'generate'], dir);
  if (!r.ok) feedback(`prisma generate failed:\n${tail(r.output, 40)}`);
}
