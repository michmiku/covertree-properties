# ADR-0002: GraphQL Yoga over Apollo Server

**Status:** Accepted
**Date:** 2026-09-24
**Deciders:** repo owner (reviewed with Claude Code, see `ai/sessions/`)

## Context

The API is SDL-first ([ADR-0001](0001-stack.md)): `schema.graphql` plus resolvers typed by
GraphQL Code Generator. We need a server that runs that schema on Node, lets tests inject a fake
Weatherstack client through the context (SPEC X1, X2), and can be exercised in tests without
opening a port. There is one schema, no federation, and no hosted observability requirement.

## Decision

Use **GraphQL Yoga** (`createYoga` + `createSchema`) on plain `node:http`.

## Options considered

### Option A: GraphQL Yoga (chosen)

| Dimension        | Assessment                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| Complexity       | Low: one package, works directly as a `node:http` request handler          |
| Testability      | `yoga.fetch(request)` runs a full HTTP round trip in-process               |
| Fit with codegen | `createSchema<Context>({ typeDefs, resolvers })` takes the generated types |
| Ecosystem        | Envelop plugins; smaller community than Apollo's                           |

**Pros:** built on the Fetch API, so the same app runs in tests, on Node, or on edge runtimes.
Few dependencies. GraphiQL is built in. Supports `graphql@17`, which this repo uses.
**Cons:** less familiar to reviewers than Apollo; no first-party hosted metrics.

### Option B: Apollo Server

| Dimension        | Assessment                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| Complexity       | Low–Med: `startStandaloneServer`, or a framework integration package             |
| Testability      | `server.executeOperation` skips the HTTP layer; HTTP tests need a running server |
| Fit with codegen | Equally good (`typescript-resolvers` targets both)                               |
| Ecosystem        | Largest; GraphOS usage reporting, federation                                     |

**Pros:** the best-known GraphQL server; strong documentation; a direct path to federation and
GraphOS if needed.
**Cons:** its strengths (federation, GraphOS) are unused here; testing the HTTP layer needs a
listening server or an extra adapter.

## Trade-off analysis

The two are equivalent for resolvers and codegen, so the choice comes down to operational fit.
Yoga's in-process `fetch` makes the resolver → service → Weatherstack path testable with MSW and
no network or ports, which is the main quality requirement here (X2). Apollo's advantages only pay
off with a federated graph or GraphOS, which are non-goals.

## Consequences

- **Easier:** integration tests call `createApp(context).fetch(...)` against real Postgres; the
  context is a plain object, so injecting fakes is trivial.
- **Harder:** reviewers who know only Apollo must read Yoga's context and plugin docs (small surface).
- **Revisit:** if the graph becomes federated or needs GraphOS, move to Apollo Server. The
  schema and resolvers carry over unchanged.

## Action items

1. [x] Scaffold `apps/api/src/app.ts` with `createYoga({ schema: createSchema(...), context })`.
2. [ ] Use `yoga.fetch` for API integration tests in each slice.
