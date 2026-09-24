#!/usr/bin/env node
// Stop: typecheck + unit tests, but only when source files changed since the last green run.
// Loop-safe: if Claude is already continuing because of this hook, let it stop.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { feedback, projectDir, readInput, run, tail } from './lib.mjs';

const SOURCE = /\.(ts|tsx|mts|cts|graphql|prisma)$/;

const input = await readInput();
if (input.stop_hook_active) process.exit(0);
const root = projectDir(input);

const status = run('git', ['status', '--porcelain', '--untracked-files=all'], root);
if (!status.ok) process.exit(0);
const changed = status.output
  .split('\n')
  .map((l) => l.slice(3).split(' -> ').pop())
  .filter((f) => f && SOURCE.test(f));
if (changed.length === 0) process.exit(0);

// Fingerprint = changed paths + mtimes; skip if identical to the last passing run.
const hash = createHash('sha256');
for (const f of changed.sort()) {
  const abs = path.join(root, f);
  hash.update(`${f}:${existsSync(abs) ? statSync(abs).mtimeMs : 'deleted'}\n`);
}
const fingerprint = hash.digest('hex');
const stamp = path.join(root, '.git', 'claude-stop-check');
if (existsSync(stamp) && readFileSync(stamp, 'utf8') === fingerprint) process.exit(0);

for (const script of ['typecheck', 'test:unit']) {
  const r = run('pnpm', ['run', script], root);
  if (!r.ok) {
    feedback(
      `Stop check: \`pnpm run ${script}\` failed (${changed.length} changed source file(s)). ` +
        `Fix it before finishing, or say why it is expected to fail:\n${tail(r.output)}`,
    );
  }
}
writeFileSync(stamp, fingerprint);
