# AI workflow

How this repo is built with Claude Code: the tools, the harness, and why each piece exists. Every
session is archived in [`ai/sessions/`](ai/sessions/README.md); the [Session log](#session-log)
below is the narrative.

**Design rule:** anything that must _always_ happen is a **hook or code** (deterministic, can't be
forgotten). Anything that needs _judgment_ is a **skill or agent**. `CLAUDE.md` holds only what the
model must _know_. Rules that can be enforced are enforced; CLAUDE.md explains why.

## Tools

| Tool                                | Scope                                                 | Why                                                                                                 |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code (Opus 5.5)              | main session                                          | planning, implementation, review orchestration                                                      |
| **context7** MCP                    | `.mcp.json`                                           | current docs for Prisma / Yoga / Apollo / codegen / shadcn; their APIs changed across recent majors |
| **Playwright** MCP                  | `.mcp.json`                                           | browser smoke tests of the running UI in `/verify`                                                  |
| `write-spec`, `architecture` skills | `.claude/skills/` (third-party, see `THIRD_PARTY.md`) | produced [docs/SPEC.md](docs/SPEC.md) and [docs/adr/0001-stack.md](docs/adr/0001-stack.md)          |
| `skill-creator` plugin              | project plugin                                        | drafted the custom skills and their `evals/evals.json`                                              |
| `frontend-design` plugin            | project plugin                                        | UI direction for `apps/web`                                                                         |

## Harness

### CLAUDE.md, what the model must know

[CLAUDE.md](CLAUDE.md) (~50 lines): commands, the resolver → service → repository layering rule,
Weatherstack injection, codegen workflow, test isolation, and when to use each skill and agent.
It's kept short on purpose, and every rule in it that can be enforced is enforced below.

### Hooks (`.claude/settings.json` → `.claude/hooks/`, `scripts/`)

| Hook                                          | Does                                                                                                              | Why a hook, not a rule                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| PostToolUse `Edit\|Write` → `format-lint.mjs` | prettier + `eslint --fix` on the edited file; remaining errors go back to Claude (exit 2)                         | Formatting and lint would otherwise depend on the model remembering; this way layering violations are caught on the edit that introduces them |
| PostToolUse `Edit\|Write` → `codegen.mjs`     | `.graphql` → `pnpm codegen`; `schema.prisma` → `prisma generate`                                                  | Stale generated types are the most common SDL-first failure, so a "remember to run codegen" line isn't enough                                 |
| Stop → `stop-check.mjs`                       | typecheck + unit tests, only if source files changed since the last green run; honours `stop_hook_active`         | The model can't declare "done" on red types. Skipping no-op turns keeps Q&A instant, and there's no infinite loop                             |
| SessionEnd → `archive-session.mjs --hook`     | re-launches detached, then archives + redacts transcript and subagent transcripts, renders MD, rebuilds the index | Archiving has to happen for every session, including ones that end abruptly. SessionEnd hooks get a very short time budget, hence the detach  |

### Enforcement in code

- **Layering:** `eslint.config.mjs` `no-restricted-imports` per layer (resolvers ↛ Prisma/repositories/Weatherstack; services ↛ GraphQL/Prisma, and ↛ Weatherstack except the create-property service; repositories ↛ services/resolvers).
- **No real Weatherstack in tests:** MSW `onUnhandledRequest: 'error'` + a fake key in the Vitest setup; "no request" tests also record outbound requests and assert none. E2E (`apps/web/playwright.config.ts`) starts its own stub, API and web on separate ports against postgres-test.
- **Same gate everywhere:** `pnpm verify` runs locally, in `/verify`, and in [CI](.github/workflows/ci.yml).

### Permissions (`.claude/settings.json`)

- **Allowed without prompting:** specific `pnpm`, `git` (status/diff/log/add/commit/switch/branch) and `docker compose` subcommands.
- **Not allowlisted, so they prompt:** `git push`, `git reset`, `pnpm dlx`, `docker system …`.
- **Denied:** reading `.env` / `.env.local`, directly and via common shell readers (`cat`, `grep`, `source`, `env`). `.env.example` stays readable. The redactor is the backstop if a secret still reaches a transcript.

### Agent

| Agent                                    | Model / tools         | Why it exists                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`reviewer`](.claude/agents/reviewer.md) | opus · Read/Grep/Glob | Adversarial spec-compliance check with a fresh context. It reports each SPEC criterion as PASS / UNTESTED / FAIL with file:line and test evidence. It complements `/code-review`, which finds bugs, by checking the work against the spec. |

**Considered and dropped:** planner (the main session already has plan mode), explorer (the
built-in Explore agent does this), implementer (it would move the core work into side transcripts
and lose conversation context).

### Skills (made with `skill-creator`)

| Skill                                                      | Why a skill                                                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`graphql-slice`](.claude/skills/graphql-slice/SKILL.md)   | A multi-step recipe with an order and judgment calls: SPEC criteria → schema → codegen → Prisma → repository → service → resolver → tests → UI → reviewer → verify. It also scaffolds on the first run. |
| [`verify`](.claude/skills/verify/SKILL.md)                 | A thin wrapper over `pnpm verify`, adding what a script can't do: diagnosing failures and a Playwright-MCP visual smoke test against the Weatherstack stub.                                             |
| [`workflow-notes`](.claude/skills/workflow-notes/SKILL.md) | The narrative below needs judgment, and it has to be written before the session ends, because hooks can't call the model. The index and transcripts are left to the hook.                               |

Each skill has test prompts in `evals/evals.json`. They're run through skill-creator's
with-skill/baseline loop once the apps exist. Running them earlier would generate app code before
the harness was agreed.

## Session archiving and redaction

- **Files:** `ai/sessions/<YYYY-MM-DD>-<session-id>.md` (readable) and `ai/sessions/raw/<date>-<id>[.<agentId>].jsonl` (redacted raw, main + subagents). The date is the UTC date of the first entry.
- **Rendered:** user prompts (including feedback given when rejecting a plan, and answers to questions), assistant replies, tool calls with inputs, and tool outputs truncated to 40 lines / 4 KB. System reminders and metadata are stripped.
- **Redacted in both files:** emails, `access_key=` query params, `*KEY/SECRET/TOKEN/PASSWORD=` values, bearer tokens, API keys, connection-string credentials, account/organization IDs, and absolute home paths. After writing, the files are re-scanned, and any match fails the run and is logged to `ai/sessions/.archive.log`.
- **Tests:** `scripts/__tests__/archive-session.test.mjs` (`pnpm run test:scripts`).

## Session log

<!-- Appended by /workflow-notes, oldest first. -->

### 2026-09-23 · Stack review, harness review, harness build

Session: [`efe8f907`](ai/sessions/2026-09-23-efe8f907-6c80-4a38-965a-0d59fdfddf37.md) · Stories: harness

**Goal:** Challenge the proposed stack and AI harness before any code, then build the agreed harness.

**What the AI did:**

- Reviewed the stack against the brief. Kept it, but corrected the stated reasons (Postgres for case-insensitive filtering, not JSONB), added React Router, and cut Playwright to one spec with a Weatherstack stub. Recorded in `docs/adr/0001-stack.md`.
- Wrote `docs/SPEC.md` (via `write-spec`) with stable criterion IDs (`S3.2`, `S5.4`, …) for the reviewer and tests.
- Built the root tooling (`pnpm verify`, ESLint layering rule, compose with dev + test Postgres), the hooks, permissions, the `reviewer` agent, 3 skills (via `skill-creator`), CI, CLAUDE.md, and this file.
- Built `scripts/archive-session.mjs` (redaction + rendering + index, 8 node:test tests). Migrated the old `A0-*` sessions to `<date>-<id>`, re-archived from the original transcripts because the committed copy of one was incomplete. A sixth, unarchived session (baseline commit + an interrupted start) was left out at the user's choice.

**Corrections & surprises:**

- The user rejected the first harness plan and cut 3 of the 4 proposed agents (planner, explorer, implementer), keeping only `reviewer`.
- The docs check (claude-code-guide subagent) showed SessionEnd hooks get a very short time budget, so archiving was changed to re-launch detached. It also showed Bash rule syntax is `Bash(cmd *)`, and that `permissions.ask` might not exist, so `ask` was dropped.
- Environment blockers: Corepack's signing keys were stale (so pnpm failed) and Docker was missing. Fixed after asking the user (updated Corepack, installed OrbStack). TypeScript 7 is unsupported by typescript-eslint, so it's pinned to 6.0.
- The first render of this session counted 1 prompt: user feedback given through rejected plans and AskUserQuestion answers was hidden in tool output. Fixed the renderer and added a regression test.
- The live format/lint hook caught an undefined function between two edits to `render.mjs`, the first real hook catch.
- The committed transcripts contained the user's email and org UUID; the migration redacted them.
- Custom agents only load at session start, so `reviewer` was dry-run through a general-purpose agent using its prompt.

**Prompts worth noting:**

- "Is anything I chose in the stack more complex than it needs to be" — framed the review around removing things, not adding them.
- "Is a custom skill better as a CLAUDE.md rule or maybe a hook?" — led to the design rule at the top of this file.

**Harness changes:** Everything listed above in Harness was created this session.

### 2026-09-24 · S4 details, S6 delete, X4 e2e, README, URL state and toasts

Session: [`70daf4c1`](ai/sessions/2026-09-24-70daf4c1-f90d-4c87-83a3-f50089ed21a8.md) · Stories: S4, S6, X1, X3, X4, P1

**Goal:** Check the web screens (list, detail, create, delete) and fill any gaps, run `/verify`, walk the app with the Playwright MCP, then finish the remaining spec stories.

**What the AI did:**

- Audited first. The detail and delete screens the user believed were "mostly added" did not exist: `routes/property.tsx` was a placeholder and the API had no `property`/`deleteProperty` resolvers (SDL only). There was also no Playwright setup, so `pnpm e2e` ran nothing and `verify` passed without e2e.
- Built S4 and S6 with `/graphql-slice` as vertical slices: repository `findById`/`deleteById`, services with a UUID guard (malformed id → `null` / `PropertyNotFoundError`), union mapping in resolvers, a detail view with a weather snapshot section, and a shadcn AlertDialog for delete.
- Added X4 e2e (happy and `success:false` paths) and a README (X3). `pnpm dev` now runs `prisma migrate deploy` so the app starts in 3 commands.
- Follow-up request: list filters and sort kept in the URL (they survive reload; the detail page returns to the same filtered list), toasts on create and delete (Sonner), and labelled coordinates.
- Browser walk via Playwright MCP against the stub: duplicate create, create, filters (`"  HILLS "`, `85A68`, `Fo%`), sort, detail, delete, not-found, 390px width. The AI deleted only its own test rows and left the user's dev data unchanged.
- 7 commits, one per story or concern. Mixed files were split by rebuilding each commit's tree from a snapshot with a script, and each stage was checked with format, lint, typecheck and tests.

**Corrections & surprises:**

- The two e2e "hangs" were real bugs, not slowness. (1) Vite bound only `::1`, so Playwright's IPv4 readiness check waited forever. (2) Playwright couldn't exit because `pnpm exec` (pnpm 12 native) starts children in a new process group that Playwright's teardown doesn't kill. Fix: `exec node_modules/.bin/...` plus a graceful SIGTERM. Piping through `tail` also hid progress, which made the first run look stuck.
- E2e logs showed two Apollo "cache data may be lost" warnings (`Weather` without an id; `Query.properties` shrinking after delete). Fixed with type policies in `apps/web/src/apollo.ts`.
- The reviewer agent returned DONE (13/13 PASS) plus 6 non-blocking findings, and all were fixed. The most useful one: "no Weatherstack request" tests relied on `onUnhandledRequest`, which a swallowed `fetch` would pass. Tests now assert zero recorded requests, confirmed by temporarily injecting a swallowed call. It also found that services other than create-property could import the Weatherstack client without a lint error.
- shadcn CLI prompted to overwrite `button.tsx`; declined. Its Sonner wrapper imported `next-themes` although the app has no theme provider, so the dependency was removed.
- A web test failed once when run as part of the final `verify`. The AI's first diagnosis (a late async toast) was wrong, and its first fix made the test fail every time. Reading Sonner's source showed the store replays active toasts to a new `<Toaster>`; the fix is `toast.dismiss()` in the test `afterEach`. It was folded into the toasts commit (branch not pushed).
- No shadcn skill was installed although the user asked for one; shadcn docs came through context7 instead.

**Prompts worth noting:**

- "Those were mostly added in the previous session, so confirm if there is anything missing" — the audit found this was not the case, so the session built S4 and S6 instead of polishing them.
- "like the filter sort persisting between reloads" — led to an e2e check that reloads a real browser, not only unit tests of the URL helpers.

**Harness changes:** ESLint now restricts Weatherstack imports to the create-property service; Playwright config and e2e stub added (`apps/web/e2e/`); the Enforcement section above was updated to match. No skill, hook, agent or CLAUDE.md changes.
