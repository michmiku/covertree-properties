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

### Clean profile

The sessions ran from a separate Claude Code config directory, `~/.claude-assessment`, instead
of the author's everyday profile, so its settings, memory and plans (and the transcripts the
archiver reads) are kept apart from other work. Its settings sync no skills from claude.ai
(`syncClaudeAiSkills: false`), and the project `.claude/settings.json` turns claude.ai connectors
off (`disableClaudeAiConnectors: true`). The project's own tooling is in this repo (`.claude/`,
`.mcp.json`) and in the table above. The five short setup sessions in the
[index](ai/sessions/README.md) show the setup, including a root-owned project directory that had
to be fixed first. Setup 1 ran on `claude-opus-4-8`; every later session used Opus 5.5.

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
- **Same gate everywhere:** `pnpm verify` runs locally and in `/verify`. [CI](.github/workflows/ci.yml) runs the same stages as separate jobs (lint, typecheck, test, build + e2e), plus a codegen drift job (committed GraphQL types regenerated and diffed via `pnpm codegen:check`; Prisma migrations vs `schema.prisma` via `db:drift`) and a Docker image build.

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
- **Redacted in both files:** the exact values of secret-named `.env` variables (plain, URL-encoded and JSON-escaped), emails, `access_key=`/`%3D` query params, `*KEY/SECRET/TOKEN/PASSWORD` values written as `=`, `:`, quoted, JSON (escaped at any depth) or YAML, camelCase `accessKey`-style fields, bearer tokens, API keys, connection-string credentials, account/organization IDs, and absolute home paths.
- **Fails closed:** everything is scanned in memory before anything is written. On any match nothing is archived; the leak kind (never an `.env` value) is logged to `ai/sessions/.archive.log`.
- **Labels:** `ai/sessions/labels.json` maps a short session id to an index title (used for the five setup sessions, whose generated titles were shell commands). The hook regenerates the index, so labels live there, not in `README.md`.
- **Tests:** `scripts/__tests__/archive-session.test.mjs` (`pnpm run test:scripts`).

## Token usage

Summed from the archived raw transcripts (main + subagents), one count per API message.
"Input" is uncached input. Cache reads are billed at a fraction of the input price, which is why
they dominate the counts without dominating cost. This session and any session not yet archived
are not included.

| Session    | Work                        | Models                            | Transcripts |      Input |   Cache write |      Cache read |      Output |
| ---------- | --------------------------- | --------------------------------- | ----------: | ---------: | ------------: | --------------: | ----------: |
| `206f30da` | Setup 1/5                   | claude-opus-4-8                   |           1 |     14,965 |         2,339 |          16,593 |         599 |
| `931c2f0b` | Setup 2/5                   | claude-opus-5-5                   |           1 |          4 |        44,642 |          88,330 |         956 |
| `61e23043` | Setup 3/5                   | claude-opus-5-5                   |           1 |          6 |        25,215 |          73,759 |       1,042 |
| `bb00a467` | Setup 4/5                   | claude-opus-5-5                   |           1 |          6 |         4,202 |          60,352 |         732 |
| `33a4f9b7` | Setup 5/5                   | claude-opus-5-5                   |           1 |         42 |        13,550 |         513,858 |       3,664 |
| `efe8f907` | Harness                     | claude-opus-5-5, claude-haiku-4-5 |           3 |        250 |       289,840 |      13,619,260 |     104,391 |
| `9a6944a8` | S5, API/web scaffold        | claude-opus-5-5                   |           4 |        552 |       566,129 |      54,252,352 |     231,789 |
| `70daf4c1` | S4, S6, X4, README          | claude-opus-5-5                   |           2 |        308 |       326,750 |      26,005,134 |     112,493 |
| `63f02b26` | Delivery review, PR #1      | claude-opus-5-5                   |           8 |        550 |       969,580 |      34,135,227 |     143,693 |
| `52e4e615` | Workflow notes, transcripts | claude-opus-5-5                   |           1 |         70 |        48,672 |       2,053,548 |      16,399 |
| **Total**  |                             |                                   |             | **16,753** | **2,290,919** | **130,818,413** | **615,758** |

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

### 2026-09-24 · SPEC decisions, API/web scaffold, S5 create, S1–S3 list, sort, filter

Session: [`9a6944a8`](ai/sessions/2026-09-24-9a6944a8-8343-4087-bfe9-7653041fe6fe.md) · Stories: S1, S2, S3, S5, S7, X1, X2

**Goal:** Turn the brief into a SPEC with testable criteria ("If there is something ambiguous, ask me instead of assuming stuff"), design the SDL and Prisma schema, write the ADRs, scaffold, then build stories one at a time with `/graphql-slice`.

**What the AI did:**

- Rewrote `docs/SPEC.md` through several rounds of AskUserQuestion. Decisions include result unions, six `WeatherFailureReason` values, 56 `USState` values, and rejecting duplicates before the Weatherstack call. It renumbered criteria and updated the IDs cited in CLAUDE.md, the reviewer, both skills and the evals.
- Wrote `schema.graphql` and `schema.prisma` and showed them before generating anything. Scaffolded `apps/api`: Prisma 7 with a `pg_trgm` GIN index for the city filter, Yoga, codegen, Vitest unit/integration projects, and MSW set to `onUnhandledRequest: 'error'`. Wrote ADRs 0002–0004.
- S5: added the Weatherstack client (Zod, 5 s timeout, key redaction) and a `weatherstack:probe` script. The user ran two real calls with it, and the result became a recorded fixture. Also built the repository, service, resolvers and 49 API tests, then scaffolded `apps/web` (React Router, Apollo Client 4, Tailwind v4, shadcn) with the S5.8 form and the e2e Weatherstack stub.
- S1+S2 (list, sort) and S3 (filters, `escapeLike`), each followed by a reviewer run, `pnpm verify` and a Playwright MCP smoke test. 9 commits, `1cee481` to `d768be5`; API tests went from 2 to 100, web tests from 7 to 19.

**Corrections & surprises:**

- The user's SDL request conflicted with the SPEC (a JSON scalar for weather, `sort` instead of `orderBy`). The AI asked, and the user kept the SPEC. The AI pointed out that a plain `city` index can't serve `ILIKE '%…%'`; the user chose a trigram index.
- The AI's S5.6 per-territory country table was "a wrong guess": the real probes returned `USA United States of America` for both AZ and PR. As written, the table would have rejected every property. It became one US list.
- Prisma's AI-agent guard blocked `migrate reset --force`. The user chose `migrate deploy` + TRUNCATE for integration tests.
- Toolchain friction: npm's `latest` tag for Prisma is an 8.0 RC, so it was pinned to 7.10. The web `postinstall` codegen ran before `codegen.ts` existed. Codegen 6 renamed `enumsAsConst`. graphql 16 and 17 were both installed, so a thrown `GraphQLError` was masked to `INTERNAL_SERVER_ERROR`; the fix is `createGraphQLError`, now a pitfall in `graphql-slice`.
- The reviewer's first S5 pass was NOT DONE (30 PASS / 3 UNTESTED / 1 FAIL). The main risk it found: a fractional `humidity` would be stored and then break every read. After fixes it was 33 PASS, leaving only the S5.8 list refresh, which S1's `cache-and-network` closed. S1/S2 and S3 passed with minor findings, and all but one were fixed; the X4 filter step was left for X4.
- The browser smoke test found a real layout bug (the State label shifted when the zip error appeared) and a missing favicon. Temporarily breaking the code confirmed the tests catch the change: removing `%`/`_` escaping failed 4 tests, and removing `mode: 'insensitive'` failed 6.
- Only one hook catch appears in the transcript: the lint hook rejected an `any` in a test helper.

**Prompts worth noting:**

- "Show them to me before you generate anything else" — this checkpoint surfaced the JSON-scalar, `sort` and index conflicts before any code depended on them.
- "The choices you make without asking are also fine" — accepted the defaults the AI had listed as made without asking, which ended the question rounds.
- "use the trigram index, then scaffold apps/api" — the user's answer to the flagged index problem.

**Harness changes:** CLAUDE.md criterion IDs and test-name example; reviewer criteria per failure reason; `graphql-slice` now returns unions instead of throwing, plus the Prisma 7 scaffold notes (`migrate deploy` + TRUNCATE, no `migrate reset`) and the graphql 17 error-masking pitfall; the ESLint `fetch` ban widened to all of `apps/api/src` except the Weatherstack client.

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

### 2026-09-24 · Delivery review, Docker/CI, review fixes, PR #1

Session: [`63f02b26`](ai/sessions/2026-09-24-63f02b26-8b25-48f9-9f35-ce3499714545.md) · Stories: P1, X1, X3, S5.9 (new), plus fixes in S3.4, S5.4, S5.8, S6.6, S7.3

**Goal:** Close what was outstanding (list skeleton, Docker Compose for all services, split CI with a codegen drift check, README), review the whole app, apply the chosen fixes, and open the PR.

**What the AI did:**

- Audited against git log and SPEC first; found the list skeleton was the only open P1 item and built it.
- Added a root `Dockerfile` (api/web targets), api + web in `docker-compose.yml`, `docker-compose.stub.yml` for a key-less stack, and split CI into lint / typecheck / test / codegen drift / build + e2e / docker jobs. Generated GraphQL types are now committed so `pnpm codegen:check` can diff them; `db:drift` checks migrations. Both checks were shown to fail on real drift. README rewritten (one-command start, env table, Weatherstack plan, architecture sketch).
- Ran the reviewer (44/44 PASS), a security review, `/code-review` and `/simplify` report-only, verified the top two findings by hand, and presented one deduplicated, numbered list. The user picked 9 items; each landed as its own commit with a test that fails without the fix where possible: archiver fails closed and redacts exact `.env` values, Clear bug, localhost-only ports, S5.9 one-`createProperty`-per-request rule, slim non-root API image with a `migrate` service, list cache invalidation on create, and reviewer test gaps.
- Wrote `docs/BACKLOG.md` (deferred findings + proposed features, starting with F1 maps as a proposal only), committed the re-archived session logs, pushed `main` and the branch, opened PR #1; all 6 CI jobs passed on the first run.

**Corrections & surprises:**

- `/security-review` couldn't start: it diffs against `origin/HEAD` and the remote was empty. The same review ran in an agent against `main` instead of faking a remote ref.
- Several of the AI's own slips, caught before commit: the first negative drift test stashed the edit before running the check; `codegen:check` first compared against HEAD and flagged staged files; a stray `tsc -b` left `tsconfig.tsbuildinfo`; a smoke-test log was redirected outside the repo. All redone or cleaned up.
- The first fail-closed test was wrong (an exact `.env` value is redacted, so it never reaches the leak check). Investigating it exposed a real gap: secrets containing `"` or `\` appear JSON-escaped in `.jsonl` and were missed by both redaction and the check. Fixed.
- pnpm 12 `deploy --offline` fails its supply-chain policy check; dropped `--offline`. The API image is still 786 MB because `@prisma/client` peers on the Prisma CLI; recorded in the backlog, not hidden.
- The user's `pnpm dev` held :4000 and their dev DB already had the PDF address, so browser smoke tests ran on other ports with a different street and deleted only their own row.
- The push was rejected (token lacked the `workflow` scope); the user ran `gh auth refresh -s workflow`.

**Prompts worth noting:**

- "When everything is done, list the findings, and I'll decide which to apply, if any." — kept every review report-only, including `/simplify`, which normally applies its fixes.
- "…let's verify that there is a Docker Compose for Postgres, API, and web. GitHub Actions for: lint, type check, test, codegen drift check" — answered with a gap table first; the one real design choice (commit generated types to make drift checkable) went back to the user.
- "The rest can wait for now, since there are no breaking item reported" — led to `docs/BACKLOG.md` instead of findings living only in this transcript.

**Harness changes:** CLAUDE.md (database-only compose command, `pnpm codegen:check`, X1 wording, backlog link); `/verify` skill and eval (database-only compose command, CI description); `graphql-slice` scaffold note and eval wording; CI split into jobs with a shared setup action; archiver redaction widened and made fail-closed. The Enforcement and archiving sections above were updated to match.
