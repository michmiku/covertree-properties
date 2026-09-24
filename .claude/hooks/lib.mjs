import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Hook input JSON from stdin (Claude Code passes it on every hook invocation). */
export async function readInput() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data ? JSON.parse(data) : {};
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  // eslint-disable-next-line no-control-regex
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return { ok: r.status === 0, output };
}

export function hasBin(root, name) {
  return existsSync(path.join(root, 'node_modules', '.bin', name));
}

export function tail(text, lines = 60) {
  const all = text.split('\n');
  return all.length > lines
    ? [`… (${all.length - lines} lines omitted)`, ...all.slice(-lines)].join('\n')
    : text;
}

/** Exit code 2 = feed stderr back to Claude (PostToolUse: after the fact; Stop: keep working). */
export function feedback(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
