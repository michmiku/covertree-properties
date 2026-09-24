# ADR-0003: Prisma over Drizzle

**Status:** Accepted
**Date:** 2026-09-24
**Deciders:** repo owner (reviewed with Claude Code, see `ai/sessions/`)

## Context

One table (`properties`) in PostgreSQL ([ADR-0001](0001-stack.md)). Needs: typed queries for a
case-insensitive substring filter plus sort (SPEC S2, S3), a duplicate unique constraint (S5.4),
JSON storage for `weatherData`, versioned migrations a reviewer can apply with one command, and a
clean repository layer that is the only DB-aware code (X1).

## Decision

Use **Prisma ORM 7** (`prisma-client` generator, `@prisma/adapter-pg`), with migrations
committed under `apps/api/prisma/migrations`.

## Options considered

### Option A: Prisma (chosen)

| Dimension          | Assessment                                                           |
| ------------------ | -------------------------------------------------------------------- |
| Complexity         | Med: separate schema language, `prisma generate`, `prisma.config.ts` |
| Query ergonomics   | `contains` + `mode: 'insensitive'` expresses S3.2 directly           |
| Migrations         | `migrate dev/deploy`, drift detection via `migrate diff`             |
| Reviewer knowledge | High; the most widely known TypeScript ORM                           |

**Pros:** declarative schema that reads like the SPEC's S7 table; generated types act as the
repository's return types; mature migrations with drift detection.
**Cons:**

- A generate step (automated by a Claude Code hook and `postinstall`).
- Postgres extensions and operator classes need a hand edit: the `pg_trgm` GIN index declares
  `ops: raw(...)`, and the migration adds `CREATE EXTENSION`.
- Prisma 7 needs a driver adapter.
- The CLI blocks `migrate reset` when an AI agent runs it, so tests use `migrate deploy` + `TRUNCATE`.
- The `latest` npm tag currently points to an 8.0 RC, so versions are pinned.

### Option B: Drizzle ORM

| Dimension          | Assessment                                          |
| ------------------ | --------------------------------------------------- |
| Complexity         | Low–Med: schema in TypeScript, no client generation |
| Query ergonomics   | SQL-like builder; `ilike` is explicit               |
| Migrations         | `drizzle-kit generate/migrate`; younger tooling     |
| Reviewer knowledge | Growing; less universal than Prisma                 |

**Pros:** no generate step; thin runtime; closer to SQL, so indexes and operator classes stay in
TypeScript.
**Cons:** the schema is spread through TypeScript rather than one readable contract file;
migration and drift tooling is less mature; more hand-written SQL-shaped code in repositories.

## Trade-off analysis

For a single-table CRUD API, both are more than enough. Prisma wins on reviewer familiarity and
on how directly its schema and query API map to the SPEC: one `schema.prisma` mirrors S7, and the
S3 filters are one `where` object. Its costs are real but one-time and already absorbed: generate
hooks, the trigram index edit, and pinned versions. Drizzle's advantage, the absence of codegen,
matters less here because the repo already runs GraphQL codegen on every schema change.

## Consequences

- **Easier:** repositories are small typed `where`/`orderBy` objects; migrations apply with
  `pnpm --filter api run db:deploy`.
- **Harder:** DB features Prisma can't model (extensions) live in migration SQL. Anyone changing
  the index must edit both `schema.prisma` and the migration.
- **Revisit:** Prisma 8 once it's GA; check the `postgresqlExtensions` status then.

## Action items

1. [x] Initial migration `init_property` with `pg_trgm` + GIN index on `city`.
2. [x] S3 slice: `contains` does **not** escape `%`/`_` (probed 2026-09-24); the repository escapes `\`, `%`, `_` (`escapeLike`), pinned by S3.3 tests.
