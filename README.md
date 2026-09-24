# Covertree properties

GraphQL API (`apps/api`, GraphQL Yoga + Prisma + Postgres) and React app (`apps/web`, Vite +
Apollo Client + shadcn/ui) for US property records. Creating a property records the current
Weatherstack weather and the location's latitude/longitude with it.

- Contract and acceptance criteria: [docs/SPEC.md](docs/SPEC.md)
- Design decisions: [docs/adr/](docs/adr/)
- How the AI tooling was used: [AI_WORKFLOW.md](AI_WORKFLOW.md)

## Prerequisites

- Node.js 22+
- pnpm 12 (`corepack enable` picks up the version pinned in `package.json`)
- Docker (Docker Desktop or OrbStack) for Postgres
- A [Weatherstack](https://weatherstack.com) access key (the free tier works) to create properties
  against the real service. Tests never use it.

## Setup

```sh
cp .env.example .env   # then set WEATHERSTACK_ACCESS_KEY
```

The defaults in `.env.example` match `docker-compose.yml`. The free Weatherstack tier is HTTP-only,
so keep `WEATHERSTACK_BASE_URL=http://api.weatherstack.com`.

## Run

```sh
docker compose up -d --wait   # Postgres: dev on :5432, test on :5433
pnpm install                  # also generates Prisma client and GraphQL types
pnpm dev                      # applies migrations; API http://localhost:4000/graphql, web http://localhost:5173
```

To run the app without spending Weatherstack quota, start the local stub and point the API at it:

```sh
node apps/web/e2e/weatherstack-stub.mjs            # :4999, always returns Fountain Hills weather
WEATHERSTACK_BASE_URL=http://localhost:4999 pnpm dev
```

## Test

```sh
pnpm test          # unit + integration (API against postgres-test, web with MSW)
pnpm test:unit     # fast subset, no database
pnpm e2e           # Playwright: create → list → filter → detail → delete, plus the weather-failure path
pnpm verify        # everything CI runs: format, lint, typecheck, tests, build, e2e
```

The first time you run e2e, install its browser with
`pnpm --filter web exec playwright install chromium`.

No test calls the real Weatherstack. Unit and integration tests use MSW with unhandled requests
failing the test. E2E starts its own stack on separate ports (stub :4999, API :4100, web :5174)
against the test database, so a running `pnpm dev` is never touched.

## Layout

```
apps/api   schema.graphql (the contract) → resolvers → services → repositories (Prisma)
apps/web   routes + features/properties, typed by codegen from the API schema (src/gql)
docs       SPEC and ADRs
```
