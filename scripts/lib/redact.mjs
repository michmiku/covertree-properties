import { readFileSync } from 'node:fs';
import os from 'node:os';
import { parseEnv } from 'node:util';

const R = '[REDACTED]';

// Value character class that stops at quotes, whitespace, `&` and backslashes, so replacing
// inside JSON-escaped text (raw .jsonl lines) never consumes an escape and never breaks the JSON.
const VALUE = String.raw`[^\s"'&\\]+`;

// Names that hold secrets in env files, compose output and `process.env` dumps.
const SECRET_NAME = String.raw`[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Z0-9_]*`;
// An optional quote, raw or JSON-escaped once or more (`"`, `\"`, `\\\"`, `'`), kept in place so
// JSON stays valid. Tool output that prints JSON is escaped again in the .jsonl line.
const Q = String.raw`\\*["']?`;
// Token-like value for unquoted `NAME: value` (YAML, inspect output), so code such as
// `WEATHERSTACK_ACCESS_KEY: z.string()` in a transcript is left readable.
const TOKEN = String.raw`[A-Za-z0-9_\-.+/=]{8,}(?=[\s"',;)\]}\\\`]|$)`;

/** Ordered [pattern, replacement] rules. Applied to raw JSONL lines and rendered Markdown alike. */
export const RULES = [
  // Weatherstack puts the key in the query string (also URL-encoded inside logged URLs).
  [new RegExp(String.raw`(access_key(?:=|%3D))(?!\[REDACTED)${VALUE}`, 'gi'), `$1${R}`],
  // KEY=value / KEY="value" / KEY='value' (env files, shell exports).
  [new RegExp(String.raw`\b(${SECRET_NAME}=${Q})(?!\[REDACTED)${VALUE}`, 'g'), `$1${R}`],
  // KEY: value / "KEY": "value" / KEY: 'value' (YAML, JSON, Node inspect of process.env).
  [
    new RegExp(String.raw`\b(${SECRET_NAME}${Q}[ \t]*:[ \t]*${Q})(?!\[REDACTED)${TOKEN}`, 'g'),
    `$1${R}`,
  ],
  // camelCase / snake_case fields with a quoted value: accessKey: 'v', "api_key": "v".
  [
    new RegExp(
      String.raw`\b((?:access|api|secret|auth)_?key${Q}[ \t]*[:=][ \t]*\\*["'])(?!\[REDACTED)${VALUE}`,
      'gi',
    ),
    `$1${R}`,
  ],
  [/(Bearer\s+)(?!\[REDACTED)[A-Za-z0-9._~+/=-]{8,}/g, `$1${R}`],
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, R],
  [/\b(?:ghp|gho|ghs|github_pat|sk|pk)_[A-Za-z0-9_]{16,}/g, R],
  // Credentials inside connection strings: postgres://user:pass@host -> postgres://[REDACTED]@host
  [
    /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/)(?!\[REDACTED)[^\s:/@"\\]+:[^\s@"\\]+@/g,
    `$1${R}@`,
  ],
  // Account identifiers recorded by Claude Code in transcript metadata.
  [/("(?:organization|account|org)(?:Uuid|Id)"\s*:\s*")(?!\[REDACTED)[^"\\]+/gi, `$1${R}`],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
];

function homeRules() {
  const home = os.homedir();
  const user = os.userInfo().username;
  const rules = [];
  if (home && home !== '/') rules.push([new RegExp(escape(home), 'g'), '~']);
  // Other absolute home dirs (e.g. transcripts recorded on another machine).
  rules.push([/\/(?:Users|home)\/[^/\s"'\\]+/g, '~']);
  // Claude Code encodes the project dir as -Users-<name>-Projects-...
  if (user) rules.push([new RegExp(`-(?:Users|home)-${escape(user)}-`, 'g'), '-~-']);
  return rules;
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HOME_RULES = homeRules();

// A value as it can appear: plain, URL-encoded, and JSON-escaped (inside raw .jsonl lines).
const forms = (value) => [
  ...new Set([value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)]),
];

/**
 * Redacts `text`. `secrets` are exact values (from `.env`, see `loadSecrets`) replaced wherever
 * they appear, plain or URL-encoded, whatever the surrounding format.
 */
export function redact(text, { secrets = [] } = {}) {
  let out = text;
  for (const value of secrets) for (const form of forms(value)) out = out.replaceAll(form, R);
  for (const [re, rep] of [...RULES, ...HOME_RULES]) out = out.replace(re, rep);
  return out;
}

/**
 * Secret-named values from an env file (e.g. WEATHERSTACK_ACCESS_KEY), for exact-match redaction.
 * Short values and the `.env.example` placeholder are skipped; they would redact ordinary text.
 */
export function loadSecrets(envFile) {
  let content;
  try {
    content = readFileSync(envFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return Object.entries(parseEnv(content))
    .filter(([name]) => new RegExp(`^${SECRET_NAME}$`).test(name))
    .map(([, value]) => value)
    .filter((value) => value.length >= 8 && value !== 'your-access-key');
}

/** Patterns that must never survive redaction; used as a final assertion on written files. */
const LEAKS = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ['access_key', /access_key(?:=|%3D)(?!\[REDACTED)[^\s"'&\\]/i],
  ...RULES.slice(1, 4).map(([re]) => [
    'secret assignment',
    new RegExp(re.source, re.flags.replace('g', '')),
  ]),
  ['anthropic key', /sk-ant-[A-Za-z0-9_-]{10,}/],
  ['home path', /\/(?:Users|home)\/[^/\s"'\\~]/],
];

/**
 * Returns a list of `{ kind, sample }` for anything that still looks sensitive. An exact `.env`
 * secret is reported without a sample, so the leak report never repeats the value.
 */
export function findLeaks(text, { secrets = [] } = {}) {
  const found = [];
  for (const value of secrets) {
    if (forms(value).some((form) => text.includes(form)))
      found.push({ kind: 'env secret value', sample: '[value from .env]' });
  }
  for (const [kind, re] of LEAKS) {
    const m = text.match(re);
    if (m) found.push({ kind, sample: text.slice(Math.max(0, m.index - 20), m.index + 40) });
  }
  return found;
}
