const MAX_LINES = 40;
const MAX_CHARS = 4000;

/** Parse a .jsonl transcript; malformed lines are skipped (a crash mid-write can leave one). */
export function parseJsonl(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip partial line */
    }
  }
  return entries;
}

export function truncate(text, maxLines = MAX_LINES, maxChars = MAX_CHARS) {
  const lines = text.split('\n');
  let out = lines.slice(0, maxLines).join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars);
  const shownLines = out.split('\n').length;
  const hiddenLines = lines.length - shownLines;
  if (out.length < text.length) {
    out += `\n… ${hiddenLines > 0 ? `${hiddenLines} more lines` : 'output'} truncated (${text.length} chars total)`;
  }
  return out;
}

/** Fence that is longer than any backtick run inside the content. */
function fence(content, lang = '') {
  const longest = Math.max(2, ...[...content.matchAll(/`+/g)].map((m) => m[0].length));
  const f = '`'.repeat(longest + 1);
  return `${f}${lang}\n${content}\n${f}`;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

function stripNoise(text) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(ANSI, '')
    .trim();
}

function tag(text, name) {
  const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

function time(ts) {
  return ts ? ts.slice(11, 16) : '';
}

function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content, null, 2);
  return content
    .map((c) => (c.type === 'text' ? c.text : c.type === 'image' ? '[image]' : JSON.stringify(c)))
    .join('\n');
}

function renderToolUse(block) {
  const { name, input = {} } = block;
  const head = `**🔧 ${name}**`;
  switch (name) {
    case 'Bash':
      return `${head}${input.description ? ` — ${input.description}` : ''}\n\n${fence(truncate(input.command ?? ''), 'bash')}`;
    case 'Write':
      return `${head} \`${input.file_path}\`\n\n${fence(truncate(input.content ?? ''))}`;
    case 'Edit':
      return `${head} \`${input.file_path}\`\n\n${fence(`- ${truncate(input.old_string ?? '', 15, 1500)}\n+ ${truncate(input.new_string ?? '', 25, 2500)}`, 'diff')}`;
    case 'Read':
      return `${head} \`${input.file_path}\``;
    case 'Agent':
    case 'Task':
      return `${head} (${input.subagent_type ?? 'general'}) — ${input.description ?? ''}\n\n${fence(truncate(input.prompt ?? ''))}`;
    case 'Skill':
      return `${head} \`${input.skill}\`${input.args ? `\n\n${fence(truncate(input.args))}` : ''}`;
    default:
      return `${head}\n\n${fence(truncate(JSON.stringify(input, null, 2)), 'json')}`;
  }
}

function renderUserString(raw) {
  const cmd = tag(raw, 'command-name');
  if (cmd) {
    const args = tag(raw, 'command-args');
    return `#### 🧑 User command\n\n\`${cmd}${args ? ` ${args}` : ''}\``;
  }
  const bash = tag(raw, 'bash-input');
  if (bash !== null) return `#### 🧑 User shell\n\n${fence(bash, 'bash')}`;
  const stdout = tag(raw, 'bash-stdout');
  if (stdout !== null) {
    const stderr = tag(raw, 'bash-stderr');
    const out = [stdout, stderr].filter(Boolean).join('\n');
    return out ? fence(truncate(stripNoise(out))) : null;
  }
  if (/<local-command-(stdout|stderr)>/.test(raw)) return null; // TUI output of /commands
  const text = stripNoise(raw);
  return text ? `#### 🧑 User\n\n${text}` : null;
}

/**
 * Some user input arrives as a tool result rather than a prompt: feedback given when rejecting a
 * tool call (e.g. a plan), answers to AskUserQuestion, and plan approvals. Surface those as user
 * turns instead of hiding them in collapsed tool output.
 */
function userVoice(text) {
  const feedback = text.match(/the user said:\s*([\s\S]+)$/);
  if (feedback) return { label: 'feedback', text: feedback[1].trim() };
  if (text.startsWith('Your questions have been answered:')) {
    const answers = text.replace(/\. You can now continue[\s\S]*$/, '');
    return { label: 'answered', text: answers };
  }
  if (text.startsWith('User has approved your plan'))
    return { label: 'approved the plan', text: '✅' };
  return null;
}

/**
 * Render transcript entries as Markdown blocks: user prompts, assistant text, tool calls with
 * inputs, truncated tool results. Meta entries (attachments, mode, cost, snapshots) are dropped.
 */
export function renderEntries(entries) {
  const blocks = [];
  const toolNames = new Map();
  let lastRole = null;

  for (const e of entries) {
    if (e.type === 'system' && e.subtype === 'compact_boundary') {
      blocks.push('---\n\n_Context compacted — earlier turns summarized._');
      lastRole = null;
      continue;
    }
    if (e.type !== 'user' && e.type !== 'assistant') continue;
    if (e.isMeta || e.isCompactSummary) continue;
    const content = e.message?.content;

    if (e.type === 'user') {
      if (typeof content === 'string') {
        const md = renderUserString(content);
        if (md) {
          blocks.push(md.startsWith('####') ? `${md}  \n<sub>${time(e.timestamp)} UTC</sub>` : md);
          lastRole = 'user';
        }
        continue;
      }
      for (const c of content ?? []) {
        if (c.type === 'tool_result') {
          const name = toolNames.get(c.tool_use_id) ?? 'tool';
          const text = stripNoise(resultText(c.content));
          const human = userVoice(text);
          if (human) {
            blocks.push(
              `#### 🧑 User ${human.label} (${name})  \n<sub>${time(e.timestamp)} UTC</sub>\n\n${human.text}`,
            );
            lastRole = 'user';
            continue;
          }
          const lines = text.split('\n').length;
          blocks.push(
            `<details><summary>${c.is_error ? '❌ ' : ''}${name} result (${lines} line${lines === 1 ? '' : 's'})</summary>\n\n${fence(truncate(text))}\n\n</details>`,
          );
        } else if (c.type === 'text') {
          const text = stripNoise(c.text);
          if (text) {
            blocks.push(`#### 🧑 User\n\n${text}`);
            lastRole = 'user';
          }
        } else if (c.type === 'image') {
          blocks.push('_[image attached]_');
        }
      }
      continue;
    }

    for (const c of content ?? []) {
      if (c.type === 'text' && c.text.trim()) {
        if (lastRole !== 'assistant') blocks.push('#### 🤖 Claude');
        blocks.push(c.text.trim());
        lastRole = 'assistant';
      } else if (c.type === 'tool_use') {
        if (lastRole !== 'assistant') blocks.push('#### 🤖 Claude');
        toolNames.set(c.id, c.name);
        blocks.push(renderToolUse(c));
        lastRole = 'assistant';
      }
    }
  }
  return blocks;
}

/** Fallback title: the first real prompt, shell command or slash command, shortened. */
function firstPrompt(entries) {
  for (const e of entries) {
    if (e.type !== 'user' || e.isMeta || typeof e.message?.content !== 'string') continue;
    const raw = e.message.content;
    const text = (
      tag(raw, 'command-name') ??
      tag(raw, 'bash-input')?.replace(/^/, '$ ') ??
      stripNoise(raw)
    )
      .replace(/(?:\\n|\s)+/g, ' ')
      .trim();
    if (text && !/^<(bash-std|local-command)/.test(raw))
      return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return null;
}

/** Summary metadata used for the session header and the index. */
export function summarize(entries) {
  const stamps = entries
    .map((e) => e.timestamp)
    .filter(Boolean)
    .sort();
  const title = entries.findLast((e) => e.type === 'ai-title')?.aiTitle ?? firstPrompt(entries);
  const models = new Set(
    entries
      .filter(
        (e) => e.type === 'assistant' && e.message?.model && e.message.model !== '<synthetic>',
      )
      .map((e) => e.message.model),
  );
  let prompts = 0;
  let toolCalls = 0;
  for (const e of entries) {
    if (e.isMeta) continue;
    const c = e.message?.content;
    if (
      e.type === 'user' &&
      typeof c === 'string' &&
      !/<(bash-stdout|local-command-stdout)>/.test(c)
    )
      prompts++;
    if (
      e.type === 'user' &&
      Array.isArray(c) &&
      c.some(
        (b) =>
          (b.type === 'text' && stripNoise(b.text)) ||
          (b.type === 'tool_result' && userVoice(stripNoise(resultText(b.content)))),
      )
    )
      prompts++;
    if (e.type === 'assistant' && Array.isArray(c))
      toolCalls += c.filter((b) => b.type === 'tool_use').length;
  }
  return {
    sessionId: entries.find((e) => e.sessionId)?.sessionId ?? null,
    started: stamps[0] ?? null,
    ended: stamps.at(-1) ?? null,
    title,
    models: [...models],
    prompts,
    toolCalls,
  };
}

export function renderSession({ entries, subagents = [] }) {
  const s = summarize(entries);
  const out = [
    `# ${s.title ?? 'Claude Code session'}`,
    '',
    `- **Session:** \`${s.sessionId}\``,
    `- **Started:** ${s.started ?? 'unknown'}`,
    `- **Ended:** ${s.ended ?? 'unknown'}`,
    `- **Models:** ${s.models.join(', ') || 'n/a'}`,
    `- **Prompts:** ${s.prompts} · **Tool calls:** ${s.toolCalls} · **Subagents:** ${subagents.length}`,
    '',
    '> Rendered by `scripts/archive-session.mjs`. Tool outputs are truncated and sensitive values',
    '> redacted; the redacted raw transcript is in `raw/`.',
    '',
    ...renderEntries(entries).flatMap((b) => [b, '']),
  ];
  if (subagents.length) {
    out.push('---', '', '## Subagents', '');
    for (const a of subagents) {
      const label =
        [a.meta?.agentType, a.meta?.description].filter(Boolean).join(' — ') || a.agentId;
      out.push(
        `<details><summary>🧩 ${label} (<code>${a.agentId}</code>)</summary>`,
        '',
        ...renderEntries(a.entries).flatMap((b) => [b, '']),
        '</details>',
        '',
      );
    }
  }
  return out.join('\n');
}
