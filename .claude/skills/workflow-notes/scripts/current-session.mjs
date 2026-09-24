#!/usr/bin/env node
// Prints the current Claude Code session for this repo as JSON:
//   { sessionId, date, started, transcript, sessionFile }
// "Current" = the most recently modified transcript for this project directory. sessionFile is
// where the SessionEnd hook will render it (ai/sessions/<date>-<id>.md; date = UTC of first entry).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const encoded = repo.replace(/[^A-Za-z0-9]/g, '-');
const home = os.homedir();
const configDirs = [
  process.env.CLAUDE_CONFIG_DIR,
  path.join(home, '.claude'),
  ...readdirSync(home)
    .filter((d) => d.startsWith('.claude-'))
    .map((d) => path.join(home, d)),
].filter(Boolean);

const candidates = configDirs
  .map((d) => path.join(d, 'projects', encoded))
  .filter(existsSync)
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f)),
  )
  .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (!candidates.length) {
  console.error(`No transcripts found for ${repo} (looked in ${configDirs.join(', ')})`);
  process.exit(1);
}

const transcript = candidates[0].file;
let started = null;
for (const line of readFileSync(transcript, 'utf8').split('\n')) {
  try {
    const ts = JSON.parse(line).timestamp;
    if (ts) {
      started = ts;
      break;
    }
  } catch {
    /* partial line */
  }
}
const sessionId = path.basename(transcript, '.jsonl');
const date = (started ?? new Date().toISOString()).slice(0, 10);
console.log(
  JSON.stringify(
    { sessionId, date, started, transcript, sessionFile: `ai/sessions/${date}-${sessionId}.md` },
    null,
    2,
  ),
);
