import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { archive } from '../archive-session.mjs';
import { findLeaks, loadSecrets, redact } from '../lib/redact.mjs';
import { renderEntries, summarize, truncate } from '../lib/render.mjs';

const SID = '11111111-2222-3333-4444-555555555555';
const HOME = os.homedir();

function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'archive-test-'));
  const longOutput = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
  const entries = [
    { type: 'ai-title', aiTitle: 'Test session', sessionId: SID },
    {
      type: 'attachment',
      sessionId: SID,
      timestamp: '2026-09-24T10:00:00.000Z',
      attachment: {
        type: 'credential_org',
        organizationUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      },
    },
    {
      type: 'user',
      sessionId: SID,
      timestamp: '2026-09-24T10:00:01.000Z',
      message: {
        role: 'user',
        content:
          'Contact me at jane.doe@example.com <system-reminder>hidden noise</system-reminder>',
      },
    },
    {
      type: 'assistant',
      sessionId: SID,
      timestamp: '2026-09-24T10:00:02.000Z',
      message: {
        model: 'claude-opus-5-5',
        content: [
          { type: 'text', text: 'Calling the API.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Bash',
            input: {
              command: `curl "http://api.weatherstack.com/current?access_key=abc123secret&query=85268" && cat ${HOME}/x`,
              description: 'Fetch weather',
            },
          },
        ],
      },
    },
    {
      type: 'user',
      sessionId: SID,
      timestamp: '2026-09-24T10:00:03.000Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: `WEATHERSTACK_ACCESS_KEY=abc123secret\npostgresql://bob:hunter2@localhost:5432/db\n${longOutput}`,
          },
        ],
      },
    },
  ];
  const transcript = path.join(dir, `${SID}.jsonl`);
  writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join('\n') + '\n{"partial":');

  const subDir = path.join(dir, SID, 'subagents');
  mkdirSync(subDir, { recursive: true });
  writeFileSync(
    path.join(subDir, 'agent-abc.jsonl'),
    JSON.stringify({
      type: 'assistant',
      isSidechain: true,
      timestamp: '2026-09-24T10:00:04.000Z',
      message: { content: [{ type: 'text', text: 'Subagent says hi to ops@example.org' }] },
    }),
  );
  writeFileSync(
    path.join(subDir, 'agent-abc.meta.json'),
    JSON.stringify({ agentType: 'reviewer', description: 'Review S3' }),
  );
  return { dir, transcript, outDir: path.join(dir, 'out') };
}

describe('redact', () => {
  it('removes emails, keys, credentials and home paths', () => {
    const input = `a@b.com access_key=XYZ API_TOKEN=t0k Bearer abcdefghijk postgres://u:p@h ${HOME}/p sk-ant-abcdefghijkl`;
    const out = redact(input);
    for (const secret of [
      'a@b.com',
      'XYZ',
      't0k',
      'abcdefghijk',
      'u:p@',
      HOME,
      'sk-ant-abcdefghijkl',
    ]) {
      assert.ok(!out.includes(secret), `${secret} survived: ${out}`);
    }
    assert.deepEqual(findLeaks(out), []);
  });

  it('removes secrets in quoted, YAML, JSON, nested JSON, inspect and URL-encoded forms', () => {
    const key = 'abcdef0123456789abcdef0123456789';
    for (const text of [
      `WEATHERSTACK_ACCESS_KEY="${key}"`,
      `WEATHERSTACK_ACCESS_KEY='${key}'`,
      `WEATHERSTACK_ACCESS_KEY: ${key}`,
      `"WEATHERSTACK_ACCESS_KEY": "${key}"`,
      `WEATHERSTACK_ACCESS_KEY: '${key}',`,
      `[\`WEATHERSTACK_ACCESS_KEY: ${key}\`];`,
      `export WEATHERSTACK_ACCESS_KEY="${key}"`,
      `{ accessKey: '${key}' }`,
      `"api_key": "${key}"`,
      `http://api.weatherstack.com/current?query=x%26access_key%3D${key}`,
    ]) {
      const out = redact(text);
      assert.ok(!out.includes(key), `key survived: ${out}`);
      assert.deepEqual(findLeaks(out), [], text);
      // The same text inside a JSONL line stays valid JSON.
      const line = JSON.stringify({ c: text });
      assert.ok(!redact(line).includes(key), `key survived in JSON: ${redact(line)}`);
      assert.doesNotThrow(() => JSON.parse(redact(line)));
      // Tool output that prints JSON-escaped text is escaped again in the .jsonl line.
      const nested = JSON.stringify({ c: JSON.stringify(JSON.stringify(text)) });
      assert.ok(!redact(nested).includes(key), `key survived in nested JSON: ${redact(nested)}`);
      assert.deepEqual(findLeaks(redact(nested)), [], nested);
      assert.doesNotThrow(() => JSON.parse(JSON.parse(JSON.parse(redact(nested)).c)));
    }
  });

  it('leaves code that only names a secret readable', () => {
    const text = 'WEATHERSTACK_ACCESS_KEY: z.string().min(1), WEATHERSTACK_ACCESS_KEY=${KEY:-}';
    assert.equal(redact(text).slice(0, 44), text.slice(0, 44));
  });

  it('removes exact .env secret values in any format and never echoes them in leak reports', () => {
    const secret = 'Zq9-unusual/secret+"value';
    const text = `echo ${secret} | ${encodeURIComponent(secret)} | ${JSON.stringify({ secret })}`;
    assert.ok(!redact(text, { secrets: [secret] }).includes('Zq9'));
    assert.deepEqual(findLeaks(text, { secrets: [secret] }), [
      { kind: 'env secret value', sample: '[value from .env]' },
    ]);
  });

  it('loads only secret-named, non-placeholder values from an env file', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'archive-env-'));
    const env = path.join(dir, '.env');
    writeFileSync(
      env,
      'WEATHERSTACK_ACCESS_KEY=real-key-123456\nPORT=4000\nAPI_TOKEN=short\nOTHER_KEY=your-access-key\n',
    );
    assert.deepEqual(loadSecrets(env), ['real-key-123456']);
    assert.deepEqual(loadSecrets(path.join(dir, 'missing')), []);
  });

  it('keeps JSON lines parseable', () => {
    const line = JSON.stringify({ c: 'x\naccess_key=abc\\n"quoted" me@x.io' });
    assert.doesNotThrow(() => JSON.parse(redact(line)));
  });

  it('is idempotent', () => {
    const once = redact('KEY=abc a@b.co');
    assert.equal(redact(once), once);
  });

  it('leaves ordinary package specifiers alone', () => {
    const text = 'pnpm@12.6.0 @playwright/mcp@latest skill-creator@claude-plugins-official';
    assert.equal(redact(text), text);
  });
});

describe('truncate', () => {
  it('limits lines and reports what was cut', () => {
    const out = truncate(Array.from({ length: 100 }, (_, i) => i).join('\n'), 10);
    assert.equal(out.split('\n').length, 11);
    assert.match(out, /90 more lines truncated/);
  });
});

describe('archive', () => {
  it('writes date-session-id raw, subagent and rendered files with no leaks', () => {
    const { transcript, outDir } = fixture();
    const { base, leaks } = archive({ transcript, outDir });

    assert.equal(base, `2026-09-24-${SID}`);
    assert.deepEqual(leaks, []);
    assert.deepEqual(readdirSync(path.join(outDir, 'raw')).sort(), [
      `${base}.abc.jsonl`,
      `${base}.jsonl`,
    ]);

    const md = readFileSync(path.join(outDir, `${base}.md`), 'utf8');
    assert.match(md, /^# Test session/);
    assert.match(md, /Fetch weather/);
    assert.match(md, /more lines truncated/);
    assert.match(md, /reviewer — Review S3/);
    assert.ok(!md.includes('hidden noise'), 'system reminders are stripped');
    for (const secret of [
      'jane.doe@example.com',
      'abc123secret',
      'hunter2',
      'ops@example.org',
      HOME,
    ]) {
      assert.ok(!md.includes(secret), `${secret} leaked into md`);
    }

    const raw = readFileSync(path.join(outDir, 'raw', `${base}.jsonl`), 'utf8');
    assert.ok(!raw.includes('aaaaaaaa-bbbb'), 'organization id redacted');
    for (const line of raw.split('\n').filter((l) => l && !l.startsWith('{"partial"'))) {
      assert.doesNotThrow(() => JSON.parse(line));
    }

    const index = readFileSync(path.join(outDir, 'README.md'), 'utf8');
    assert.match(index, new RegExp(`\\[Test session\\]\\(${base}\\.md\\)`));
  });

  it('writes nothing when redaction leaves a secret behind', () => {
    const { transcript, outDir } = fixture();
    // A redactor with a gap: it skips exact .env values, which the leak check still finds.
    const { written, leaks } = archive({
      transcript,
      outDir,
      secrets: ['Fetch weather'],
      scrubWith: (text) => redact(text),
    });
    assert.deepEqual(written, []);
    assert.ok(leaks.length > 0);
    assert.ok(!existsSync(outDir) || readdirSync(outDir).every((f) => f === 'raw'));
    assert.ok(
      !existsSync(path.join(outDir, 'raw')) || readdirSync(path.join(outDir, 'raw')).length === 0,
    );
  });

  it('is idempotent when re-run on the same transcript', () => {
    const { transcript, outDir } = fixture();
    archive({ transcript, outDir });
    const first = readFileSync(path.join(outDir, 'README.md'), 'utf8');
    archive({ transcript, outDir });
    assert.equal(readFileSync(path.join(outDir, 'README.md'), 'utf8'), first);
  });
});

describe('user input delivered as tool results', () => {
  it('renders plan feedback and question answers as user turns and counts them', () => {
    const entries = [
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'ExitPlanMode', input: {} }] },
      },
      {
        type: 'user',
        timestamp: '2026-09-24T10:00:00.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't1',
              is_error: true,
              content:
                "The user doesn't want to proceed... the user said:\nKeep only the reviewer agent.",
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't2',
              content: 'Your questions have been answered: "DB?"="Postgres". You can now continue.',
            },
          ],
        },
      },
    ];
    const md = renderEntries(entries).join('\n');
    assert.match(md, /#### 🧑 User feedback \(ExitPlanMode\)[\s\S]*Keep only the reviewer agent\./);
    assert.match(md, /#### 🧑 User answered[\s\S]*"DB\?"="Postgres"/);
    assert.ok(!md.includes('<details>'), 'not hidden in collapsed tool output');
    assert.equal(summarize(entries).prompts, 2);
  });
});
