#!/usr/bin/env node
/**
 * Archive a Claude Code session into ai/sessions/.
 *
 *   --hook                     SessionEnd hook mode: read hook JSON from stdin, re-launch
 *                              detached (SessionEnd hooks get a very short time budget), exit 0.
 *   --transcript <path>        Archive this transcript (manual use / migration).
 *   [--session-id <id>]        Override the id (default: from the transcript).
 *   [--out <dir>]              Output dir (default: <repo>/ai/sessions).
 *
 * Writes (all redacted):
 *   <out>/raw/<date>-<id>.jsonl            main transcript
 *   <out>/raw/<date>-<id>.<agentId>.jsonl  one per subagent
 *   <out>/<date>-<id>.md                   readable rendering
 *   <out>/README.md                        regenerated index
 * Exits non-zero if anything sensitive survives redaction.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { findLeaks, redact } from './lib/redact.mjs';
import { parseJsonl, renderSession, summarize } from './lib/render.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function hookMode(outDir) {
  const input = JSON.parse((await readStdin()) || '{}');
  if (!input.transcript_path || !existsSync(input.transcript_path)) return;
  mkdirSync(outDir, { recursive: true });
  const log = openSync(path.join(outDir, '.archive.log'), 'a');
  const args = [SELF, '--transcript', input.transcript_path, '--out', outDir];
  if (input.session_id) args.push('--session-id', input.session_id);
  // Detach so archiving finishes after Claude Code exits; failures land in .archive.log.
  spawn(process.execPath, args, { detached: true, stdio: ['ignore', log, log] }).unref();
}

function loadSubagents(transcriptPath, sessionId) {
  const dir = path.join(path.dirname(transcriptPath), sessionId, 'subagents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^agent-.+\.jsonl$/.test(f))
    .sort()
    .map((f) => {
      const agentId = f.slice('agent-'.length, -'.jsonl'.length);
      const metaPath = path.join(dir, `agent-${agentId}.meta.json`);
      const raw = readFileSync(path.join(dir, f), 'utf8');
      return {
        agentId,
        raw,
        entries: parseJsonl(raw),
        meta: existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null,
      };
    });
}

const redactJsonl = (raw) => raw.split('\n').map(redact).join('\n');

export function archive({ transcript, sessionId, outDir }) {
  const raw = readFileSync(transcript, 'utf8');
  const entries = parseJsonl(raw);
  const meta = summarize(entries);
  const id = sessionId ?? meta.sessionId ?? path.basename(transcript, '.jsonl');
  if (!meta.started) throw new Error(`No timestamps in ${transcript}; cannot date the session.`);
  const base = `${meta.started.slice(0, 10)}-${id}`;
  const subagents = loadSubagents(transcript, id);

  const rawDir = path.join(outDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  const written = [];
  const write = (file, content) => {
    writeFileSync(file, content);
    written.push(file);
  };
  write(path.join(rawDir, `${base}.jsonl`), redactJsonl(raw));
  for (const a of subagents)
    write(path.join(rawDir, `${base}.${a.agentId}.jsonl`), redactJsonl(a.raw));
  write(path.join(outDir, `${base}.md`), redact(renderSession({ entries, subagents })));
  write(path.join(outDir, 'README.md'), renderIndex(outDir));

  const leaks = written.flatMap((file) =>
    findLeaks(readFileSync(file, 'utf8')).map((l) => ({ file: path.relative(REPO, file), ...l })),
  );
  return { base, written, leaks };
}

const SESSION_MD = /^(\d{4}-\d{2}-\d{2})-([0-9a-f-]{36})\.md$/;

export function renderIndex(outDir) {
  const rows = readdirSync(outDir)
    .map((f) => ({ f, m: f.match(SESSION_MD) }))
    .filter(({ m }) => m)
    .map(({ f, m }) => {
      const md = readFileSync(path.join(outDir, f), 'utf8');
      const field = (label) =>
        md.match(new RegExp(`\\*\\*${label}:\\*\\* ([^·\\n]+)`))?.[1].trim() ?? '';
      return {
        f,
        date: m[1],
        id: m[2],
        title: md.match(/^# (.+)$/m)?.[1] ?? '',
        started: field('Started'),
        prompts: field('Prompts'),
        tools: field('Tool calls'),
        subagents: field('Subagents'),
      };
    })
    .sort((a, b) => a.started.localeCompare(b.started));

  return [
    '# AI sessions',
    '',
    'Every Claude Code session on this repo, archived automatically by the `SessionEnd` hook',
    '(`scripts/archive-session.mjs`). Each row links a readable rendering; the redacted raw',
    'transcripts (main + subagents) are in [`raw/`](raw/). The narrative of what happened and',
    'why lives in [`AI_WORKFLOW.md`](../../AI_WORKFLOW.md) (written by `/workflow-notes`).',
    '',
    '| Started (UTC) | Title | Prompts | Tool calls | Subagents | Session |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.started.replace('T', ' ').slice(0, 16)} | [${r.title.replace(/\|/g, '\\|')}](${r.f}) | ${r.prompts} | ${r.tools} | ${r.subagents} | \`${r.id.slice(0, 8)}\` |`,
    ),
    '',
  ].join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      hook: { type: 'boolean', default: false },
      transcript: { type: 'string' },
      'session-id': { type: 'string' },
      out: { type: 'string', default: path.join(REPO, 'ai', 'sessions') },
    },
  });
  const outDir = path.resolve(values.out);
  if (values.hook) return hookMode(outDir);
  if (!values.transcript)
    throw new Error('Usage: archive-session.mjs --transcript <path> | --hook');

  const { base, written, leaks } = archive({
    transcript: path.resolve(values.transcript),
    sessionId: values['session-id'],
    outDir,
  });
  console.log(`[${new Date().toISOString()}] archived ${base}: ${written.length} files`);
  if (leaks.length) {
    for (const l of leaks) console.error(`LEAK ${l.kind} in ${l.file}: …${l.sample}…`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main().catch((err) => {
    console.error(`[${new Date().toISOString()}] archive-session failed: ${err.stack ?? err}`);
    process.exitCode = 1;
  });
}
