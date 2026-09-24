# Covertree properties

GraphQL API (`apps/api`, GraphQL Yoga + Prisma + Postgres) and React app (`apps/web`, Vite +
Apollo Client + shadcn/ui) for US property records. Creating a property records the current
Weatherstack weather and the location's latitude/longitude with it.

- Contract and acceptance criteria: [docs/SPEC.md](docs/SPEC.md)
- Design decisions: [docs/adr/](docs/adr/)
- Deferred work and proposed features: [docs/BACKLOG.md](docs/BACKLOG.md)
- How the AI tooling was used: [AI_WORKFLOW.md](AI_WORKFLOW.md)
- Every Claude Code session, archived: [ai/sessions/README.md](ai/sessions/README.md). To follow the
  build, read `efe8f907` (harness) → `9a6944a8` (S5 and web scaffold) → `70daf4c1` (web screens)
  → `63f02b26` (delivery review). The earlier short sessions are editor setup.

## Quick start (one command)

Needs Docker only. Put your Weatherstack key in `.env`, then start Postgres, the API and the web
app:

```sh
cp .env.example .env   # set WEATHERSTACK_ACCESS_KEY
docker compose up --build
```

Open http://localhost:5173 (API: http://localhost:4000/graphql). A one-shot `migrate` service
applies migrations before the API starts; the API image itself is production-only and runs as a
non-root user.

No key, or want to save quota? Use the local Weatherstack stub. It always returns the same
Fountain Hills, AZ weather:

```sh
docker compose -f docker-compose.yml -f docker-compose.stub.yml up --build
```

## Environment variables

Copy `.env.example` to `.env` at the repo root. Both apps read it; `.env` is never committed.

| Variable                  | Used by   | Default in `.env.example`                                        | Notes                                                        |
| ------------------------- | --------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `WEATHERSTACK_ACCESS_KEY` | API       | `your-access-key`                                                | **Required.** Your Weatherstack key.                         |
| `WEATHERSTACK_BASE_URL`   | API       | `https://api.weatherstack.com`                                   | `http://localhost:4999` for the stub.                        |
| `DATABASE_URL`            | API       | `postgresql://covertree:covertree@localhost:5432/covertree`      | Dev database (`postgres` service).                           |
| `TEST_DATABASE_URL`       | API tests | `postgresql://covertree:covertree@localhost:5433/covertree_test` | Integration tests and e2e (`postgres-test` service, tmpfs).  |
| `PORT`                    | API       | `4000`                                                           |                                                              |
| `WEB_ORIGIN`              | API       | `http://localhost:5173`                                          | Only origin allowed by CORS. Open the app on this exact URL. |
| `VITE_GRAPHQL_URL`        | web       | `http://localhost:4000/graphql`                                  | Inlined at build time.                                       |

The API checks its variables on start and exits naming any that are missing or invalid.
`docker compose up` only takes `WEATHERSTACK_ACCESS_KEY` and `WEATHERSTACK_BASE_URL` from `.env`.
It sets the rest itself, so the containers reach each other by service name. A `localhost` base URL
does not work inside the container; use `docker-compose.stub.yml` for the stub instead.

## Weatherstack plan

The app works on Weatherstack's **free plan** over `https://`. The plan allows **about 100 calls a
month**. Only `createProperty` calls Weatherstack, once per property. Invalid input and duplicates
are rejected before the call, so they don't use quota. Listing, details and delete read from
Postgres. When the quota runs out, Weatherstack answers HTTP 200 with `success: false`. The API
reports that as `WeatherUnavailableError { reason: UPSTREAM_ERROR }` and saves nothing
([ADR 0004](docs/adr/0004-weather-failure-policy.md)).

Tests never call Weatherstack, so they cost no quota. For manual testing, use the stub.

## Architecture

```
 Browser ── React app (apps/web) ── Apollo Client, types generated from the schema (src/gql)
                  │
                  │ GraphQL over HTTP
                  ▼
 GraphQL Yoga (apps/api) ── schema.graphql is the contract; codegen → resolver types
   resolvers      map GraphQL ⇄ service calls; domain results → union types (…Success | …Error)
      │
   services       validation (Zod for what SDL can't express), business rules; no GraphQL imports
      │    └──────────────▶ Weatherstack client  (built once in container.ts, injected into the
      │                      create-property service only; Zod-parsed)  ──▶ api.weatherstack.com
   repositories   the only Prisma users
      │
   PostgreSQL 17  (docker compose: dev :5432, test :5433)
```

### How `weatherData` maps Weatherstack's `current`

`createProperty` asks Weatherstack for `"<zip>, <state>, USA"` with `units=f`, validates the
response with Zod (`src/weatherstack/schema.ts`) and stores the `current` object **as returned**
(snake_case keys, unknown keys kept) in the `weather_data` JSON column, next to `lat`/`long` parsed
from `location`. It is never refreshed. The `Weather` resolvers rename fields on the way out:

| GraphQL `Weather`                                            | Weatherstack `current`     | Note                            |
| ------------------------------------------------------------ | -------------------------- | ------------------------------- |
| `observationTime`                                            | `observation_time`         | UTC, e.g. `10:35 AM`            |
| `temperature`                                                | `temperature`              | °F                              |
| `feelsLike`                                                  | `feelslike`                | °F                              |
| `weatherDescriptions`                                        | `weather_descriptions`     | Each entry trimmed              |
| `weatherIcons`                                               | `weather_icons`            |                                 |
| `windSpeed`                                                  | `wind_speed`               | mph                             |
| `windDir`, `windDegree`                                      | `wind_dir`, `wind_degree`  |                                 |
| `weatherCode`, `uvIndex`                                     | `weather_code`, `uv_index` | `null` when absent              |
| `isDay`                                                      | `is_day`                   | `"yes"`/`"no"` → `true`/`false` |
| `humidity`, `pressure`, `precip`, `cloudcover`, `visibility` | same name                  | `precip` in inches              |

Fields the detail page shows are required at creation; the rest are nullable, so a missing extra
field does not block creation. Other keys Weatherstack sends are stored but not exposed.

ESLint `no-restricted-imports` enforces the layering. The generated GraphQL types are committed,
and CI fails if they are out of date. The ADRs record the reasons: Yoga over Apollo Server, Prisma
over Drizzle, and failing creation when the weather lookup fails.

## Develop without Docker for the apps

Node.js 22+ and pnpm 12 (`corepack enable`). Postgres still runs in Docker:

```sh
docker compose up -d --wait postgres postgres-test   # databases only
pnpm install                                         # also generates the Prisma client
pnpm dev                                             # applies migrations; API :4000, web :5173 (hot reload)
```

To use the stub instead of real Weatherstack:

```sh
node apps/web/e2e/weatherstack-stub.mjs              # :4999
WEATHERSTACK_BASE_URL=http://localhost:4999 pnpm dev
```

After editing `apps/api/src/schema.graphql` or a query in `apps/web`, run `pnpm codegen` and
commit the regenerated types. For a schema change to the database, run
`pnpm --filter api exec prisma migrate dev --name <change>`.

## Tests

Start the test database first with `docker compose up -d --wait postgres-test`.

```sh
pnpm test            # unit + integration (API against postgres-test, web with MSW)
pnpm test:unit       # fast subset, no database
pnpm e2e             # Playwright: create → list → filter → detail → delete, plus the weather-failure path
pnpm verify          # format, lint, typecheck, tests, build, e2e
pnpm codegen:check   # generated GraphQL types match the schema and documents
```

The first time you run e2e, install its browser with
`pnpm --filter web exec playwright install chromium`.

No test calls the real Weatherstack. Unit and integration tests use MSW, and any unhandled request
fails the test. E2E starts its own stack on separate ports (stub :4999, API :4100, web :5174)
against the test database, so a running `pnpm dev` or `docker compose` stack is never touched.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs these as separate jobs: lint
(Prettier + ESLint), typecheck, test, **codegen drift** (GraphQL types plus a check that Prisma
migrations match `schema.prisma`), build + e2e, and a Docker image build.
