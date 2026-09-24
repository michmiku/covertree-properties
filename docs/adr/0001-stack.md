# ADR-0001: Application stack

**Status:** Accepted
**Date:** 2026-09-24
**Deciders:** repo owner (reviewed with Claude Code, see `ai/sessions/`)

## Context

We need a GraphQL API + React app for US property records ([SPEC](../SPEC.md)). Constraints from
the brief: TypeScript/Node backend, React/TypeScript frontend, any database, a running app with a
README, Weatherstack called only in the create mutation. The assessment grades technology
selection, code smells/complexity, scope completion and the AI harness, so we want **the smallest stack that is
still production-shaped**. Weatherstack's free tier is ~100 calls/month and (historically)
HTTP-only, so tests must never reach it.

## Decision

| Concern    | Choice                                                                                             | Deliberately **not** chosen     |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------- |
| Repo       | pnpm workspaces: `apps/api`, `apps/web`                                                            | Turborepo/Nx, `packages/shared` |
| API        | GraphQL Yoga on `node:http`, **SDL-first** `schema.graphql`                                        | Express, Apollo Server, Pothos  |
| Types      | GraphQL Code Generator: `typescript-resolvers` (+ Prisma mappers) for api, `client-preset` for web | hand-written types              |
| Data       | Prisma + PostgreSQL (docker compose)                                                               | SQLite, Drizzle                 |
| Validation | Zod at the edges GraphQL can't cover; `enum USState` in SDL                                        | Zod shared package              |
| Web        | Vite + React + React Router + Apollo Client                                                        | Next.js, urql, TanStack Query   |
| UI         | shadcn/ui (Tailwind), only components used                                                         | Mantine, MUI                    |
| Tests      | Vitest + MSW; one Playwright happy-path spec                                                       | many e2e specs, real-API tests  |

## Options considered (per contested choice)

### API schema style: SDL-first + codegen (chosen) vs code-first Pothos

| Dimension                 | SDL-first + codegen             | Pothos                           |
| ------------------------- | ------------------------------- | -------------------------------- |
| Complexity                | Med (codegen step)              | Med (builder API, Prisma plugin) |
| Readability for reviewers | High — one `.graphql` contract  | Schema only visible when printed |
| Client typing             | Same file feeds `client-preset` | Needs schema emit step anyway    |

**Why SDL-first:** the schema file is the single contract for both sides; codegen runs automatically
via a Claude Code hook, removing its main downside (stale types).

### Database: Postgres (chosen) vs SQLite

| Dimension                           | Postgres                     | SQLite                                               |
| ----------------------------------- | ---------------------------- | ---------------------------------------------------- |
| Setup for reviewer                  | `docker compose up -d`       | none                                                 |
| Case-insensitive filter (SPEC S3.2) | Prisma `mode: 'insensitive'` | unsupported in Prisma; would need normalized columns |
| Prod parity / migrations            | High                         | Medium                                               |

**Why Postgres:** S3.2 plus prod parity. Note: JSONB is **not** a reason — `weatherData` is stored
and returned, never queried.

### Validation: Zod at boundaries (chosen) vs Zod everywhere

GraphQL already enforces shape and scalar types. Zod is used where it adds value: `zipCode`
(`^\d{5}$`), trimming/length, and **parsing the untrusted Weatherstack response** (including
`success:false` bodies and string `lat`/`lon`). `state` is a GraphQL enum, so it is validated by the
schema and typed on the client for free. No shared Zod package — the server is the source of truth;
the web form mirrors the simple rules.

### Client: Apollo Client (chosen) vs urql / TanStack Query

Apollo's normalized cache is more than this app needs, but it is the idiomatic GraphQL client, works
directly with `client-preset` `TypedDocumentNode`s, and is what reviewers expect. We use
`refetchQueries` after create/delete rather than manual cache writes to keep it simple.

### E2E: one Playwright spec (chosen) vs none / many

One spec proves the "running application" end to end. Playwright's `page.route` only intercepts
browser traffic; the api→Weatherstack call is server-side, so e2e points `WEATHERSTACK_BASE_URL` at
a local stub server started by Playwright's `webServer`.

## Trade-off analysis

We accept two build-time steps (codegen, Prisma generate) and Docker as a prerequisite in exchange
for end-to-end type safety from one contract and a database that satisfies the filtering
requirement natively. Everything with no requirement behind it (task runner, shared package,
pagination, auth) is left out and recorded in SPEC non-goals.

## Consequences

- **Easier:** adding a field = edit `schema.graphql` → types regenerate for resolvers and UI;
  Weatherstack behaviour is testable offline (injected client + MSW).
- **Harder:** onboarding needs Docker; the free Weatherstack tier's HTTP-only restriction means the
  base URL must be configurable.
- **Revisit:** pagination (SPEC P2); Prisma/Apollo major versions — check docs via context7 when
  scaffolding.

## Action items

1. [ ] Scaffold `apps/api` and `apps/web` on the first `/graphql-slice` run.
2. [ ] Enforce layering + test isolation in config (ESLint `no-restricted-imports`, MSW
       `onUnhandledRequest: 'error'`).
3. [ ] Verify Weatherstack HTTP/HTTPS and query format with the real key on first create.
