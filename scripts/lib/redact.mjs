import os from 'node:os';

const R = '[REDACTED]';

// Value character class that stops at quotes, whitespace, `&` and backslashes, so replacing
// inside JSON-escaped text (raw .jsonl lines) never consumes an escape and never breaks the JSON.
const VALUE = String.raw`[^\s"'&\\]+`;

/** Ordered [pattern, replacement] rules. Applied to raw JSONL lines and rendered Markdown alike. */
export const RULES = [
  // Weatherstack puts the key in the query string.
  [new RegExp(String.raw`(access_key=)(?!\[REDACTED)${VALUE}`, 'gi'), `$1${R}`],
  // KEY=value / SECRET=value / TOKEN=value / PASSWORD=value (env files, shell exports).
  [
    new RegExp(
      String.raw`\b([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Z0-9_]*)=(?!\[REDACTED)${VALUE}`,
      'g',
    ),
    `$1=${R}`,
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

export function redact(text) {
  let out = text;
  for (const [re, rep] of [...RULES, ...homeRules()]) out = out.replace(re, rep);
  return out;
}

/** Patterns that must never survive redaction; used as a final assertion on written files. */
const LEAKS = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ['access_key', /access_key=(?!\[REDACTED)[^\s"'&\\]/i],
  [
    'secret assignment',
    /\b[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*=(?!\[REDACTED)[^\s"'&\\]/,
  ],
  ['anthropic key', /sk-ant-[A-Za-z0-9_-]{10,}/],
  ['home path', /\/(?:Users|home)\/[^/\s"'\\~]/],
];

/** Returns a list of `{ kind, sample }` for anything that still looks sensitive. */
export function findLeaks(text) {
  const found = [];
  for (const [kind, re] of LEAKS) {
    const m = text.match(re);
    if (m) found.push({ kind, sample: text.slice(Math.max(0, m.index - 20), m.index + 40) });
  }
  return found;
}
