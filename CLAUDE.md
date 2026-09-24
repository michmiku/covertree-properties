# Covertree properties

GraphQL API (`apps/api`) + React app (`apps/web`) for US property records; `createProperty`
enriches each record with Weatherstack weather + lat/long. Contract: [docs/SPEC.md](docs/SPEC.md)
(story IDs `S1`–`S7`, criteria like `S3.2`). Stack rationale: [docs/adr/](docs/adr/). Harness
and session log: [AI_WORKFLOW.md](AI_WORKFLOW.md).

## Commands

- `docker compose up -d --wait postgres postgres-test` — Postgres only (dev :5432, test :5433).
  Plain `docker compose up` also builds and starts api :4000 and web :5173.
- `pnpm install` · `pnpm dev` — api :4000, web :5173
- `pnpm codegen` — GraphQL types (a hook runs it when you edit a `.graphql` file)
- `pnpm codegen:check` — generated GraphQL types are committed; CI fails on drift
- `pnpm --filter api exec prisma migrate dev --name <change>` — new migration
- `pnpm test` · `pnpm test:unit` · `pnpm e2e`
- `pnpm verify` — format check, lint, typecheck, all tests, build, e2e. Must pass before commit.

pnpm 12: there is no `pnpm -s`; use `pnpm run <script>` / `pnpm exec <bin>`.

## Architecture rules

- **Layering:** resolver → service → repository. Resolvers map GraphQL ⇄ service calls and
  errors; services hold the logic and never import GraphQL; repositories are the only Prisma
  users. ESLint `no-restricted-imports` enforces this. Fix the design, don't disable the rule.
- **Weatherstack** is called only from the create-property service. The client is built once and
  injected through the Yoga context, never imported by resolvers. Parse its response with Zod:
  HTTP 200 can still be `{ success: false }`, and `lat`/`lon` are strings (SPEC S5.5).
- **Schema is the contract:** edit `apps/api/src/schema.graphql` first. Never hand-edit generated
  files (`__generated__/`, `src/gql/`) or duplicate generated types.
- **Validation:** GraphQL types/enums first (`USState`); Zod only for what SDL can't express
  (zip `^\d{5}$`, trimming) and for external responses.

## Tests

- **Never call the real Weatherstack.** Tests use MSW with `onUnhandledRequest: 'error'` and a fake
  `WEATHERSTACK_ACCESS_KEY`; e2e points `WEATHERSTACK_BASE_URL` at a local stub. A test that needs
  the network is a bug.
- Integration tests use `TEST_DATABASE_URL` (postgres-test), never the dev database.
- Name tests after SPEC criteria (`it('S3.2 matches city as a case-insensitive substring')`). The reviewer
  agent looks for them.

## Working here

- Before writing Prisma, Yoga, Apollo Client, codegen or shadcn code/config, look up the current
  docs with **context7**. Their APIs changed across recent majors.
- Implement a story with `/graphql-slice <story>`; before calling it done, run the **reviewer**
  agent on it; run `/verify` before committing; run `/workflow-notes` at the end of a session.
- Hooks already format/lint every edit, regenerate types, and typecheck + unit-test when you stop.
  Act on their feedback instead of working around it.
- Secrets: never read `.env` (denied). Add new variables to `.env.example` with a placeholder.
- Commits: conventional (`feat(api): S5 createProperty`), one story or concern per commit.
