---
name: graphql-slice
description: Implement one user story from docs/SPEC.md end to end as a vertical slice through the GraphQL API and React app, in contract-first order (schema.graphql → codegen → Prisma → repository → service → resolver → tests → web UI → review). Use this whenever the user asks to build, implement, add, or finish a story or feature of the property app, e.g. "do S3", "add filtering by zip", "implement createProperty", "build the delete button", "next story", even if they don't say "slice". The first run also scaffolds apps/api and apps/web.
argument-hint: '<story id, e.g. S5>'
---

# GraphQL slice

Build one story from `docs/SPEC.md` so it works end to end and is provably done. The order below
matters. The schema is the contract, so types flow from it to every layer. Tests are named after
SPEC criteria, so the reviewer agent can check each one.

The architecture and testing rules live in `CLAUDE.md` (layering, Weatherstack injection, no real
network in tests, never edit generated files). Follow them rather than re-deriving them. The ESLint
layering rule and the hooks enforce them anyway.

## 0. Frame the slice

1. Read the story and **every** criterion ID for it in `docs/SPEC.md`, plus `X1`–`X4`.
2. List the criteria you will satisfy, and note which layer and which test proves each one. Show
   the user this short plan before coding.
3. If a criterion is ambiguous, or conflicts with the code, stop and ask. Don't silently change
   behavior the SPEC defines. If the user agrees to a change, update `docs/SPEC.md` in the same
   slice.

## 1. Scaffold (first slice only)

If `apps/api` or `apps/web` doesn't exist yet, scaffold the missing app(s) first, following
[references/scaffold.md](references/scaffold.md). Scaffold only what this slice needs plus the
test harness. Look up current versions and APIs with **context7** first. Prisma, Apollo Client and
codegen presets have changed shape across recent majors, and stale memory produces broken config.

## 2. API, contract first

Work in this order. Each step compiles against the previous one.

1. **Schema:** edit `apps/api/src/schema.graphql`. Keep names aligned with the SPEC (`Property`,
   `USState`, `PropertyFilter`, `orderBy: { createdAt }`). The codegen hook regenerates types. If
   it reports an error, fix the schema before moving on.
2. **Prisma** (only if the data shape changes): edit `prisma/schema.prisma`, then
   `pnpm --filter api exec prisma migrate dev --name <story-change>`. Commit the migration.
3. **Repository:** Prisma queries only. Return domain objects, not GraphQL types.
4. **Service:** business rules, validation (Zod for what SDL can't express), and orchestration.
   It takes its dependencies (repository, Weatherstack client) as arguments or from context, so
   tests can swap them.
5. **Resolver:** thin. Map args → service call → result. Mutations return the SPEC's result
   unions (`CreatePropertyResult`, `DeletePropertyResult`): map domain results to union members
   and resolve `__typename`; never throw expected failures. Only invalid query arguments use
   `GraphQLError` with `BAD_USER_INPUT`.
6. **API tests** (Vitest):
   - one test per criterion, named with its ID: `it('S5.5 returns UPSTREAM_ERROR and does not persist when Weatherstack returns success:false')`
   - service unit tests with a fake repository/client for logic and error branches
   - one integration test through Yoga (`yoga.fetch`) against `postgres-test` for the happy path
   - Weatherstack via MSW handlers: success, network error, timeout, 500, `success:false`,
     malformed body, non-US country (one per `WeatherFailureReason`)

## 3. Web

1. **Document:** add the operation to a `.graphql` file (or a `graphql()` call) in
   `apps/web/src`. Run codegen and use the generated `TypedDocumentNode`. Never hand-write the
   result type.
2. **UI:** a route or component with shadcn/ui primitives. Handle all three states: loading,
   error, and empty. Use `refetchQueries` after mutations rather than manual cache writes.
3. **Web tests:** Vitest + Testing Library with MSW `graphql.query/mutation` handlers. Cover the
   criterion's user-visible behavior (e.g. S3.10 "no matches" + clear filters).

## 4. Prove it

1. Run `pnpm run typecheck && pnpm run test:unit` for fast feedback while iterating.
2. Run the **reviewer** agent (subagent) with the story ID. Fix every `FAIL` and `UNTESTED`, then
   re-run it until it says `DONE`. It works from a fresh context, so it catches what you've stopped
   seeing.
3. Run `/verify`, the full gate (lint, types, all tests, build, e2e, UI smoke).
4. Summarize for the user: the criteria covered (with test names), anything deferred and why, and
   a suggested commit message, e.g. `feat: S3 filter properties by city, zip and state`. Commit
   only if the user asks.

## Pitfalls seen in this stack

- Forgetting `mode: 'insensitive'` on the city `contains` filter (S3.2), or letting `%`/`_` act
  as wildcards (S3.3).
- Treating HTTP 200 from Weatherstack as success; check `success === false` in the body.
- Validating input or checking duplicates _after_ calling Weatherstack (S5.3/S5.4 require
  before), which wastes quota.
- `lat`/`lon` stored as strings; parse them to numbers.
- The resolver importing the Weatherstack client "just this once" is a lint error by design.
- `throw new GraphQLError(...)` from `graphql` gets masked to `INTERNAL_SERVER_ERROR` (graphql 17
  wraps it via `cause`, and Yoga 5 doesn't unwrap that). Use `createGraphQLError` from `graphql-yoga`
  for `BAD_USER_INPUT`, and assert `extensions.code` in a test.
