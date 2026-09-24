# Scaffold reference (first slice only)

Check each library's current API with context7 before writing config. Pin what you install
(`pnpm add` writes exact ranges; commit `pnpm-lock.yaml`). pnpm ≥10 blocks dependency build
scripts by default, so approve Prisma/esbuild when pnpm asks (`pnpm approve-builds`).

## apps/api

```
apps/api/
  package.json          name "api", type module; scripts below
  tsconfig.json         extends ../../tsconfig.base.json
  codegen.ts            typescript + typescript-resolvers → src/__generated__/resolvers-types.ts
                        mappers: Property → Prisma Property (mapperTypeSuffix Model); enumsAsTypes
  prisma.config.ts      Prisma 7: schema/migrations paths + datasource url (loads root .env)
  prisma/schema.prisma  generator prisma-client → src/__generated__/prisma; see the file for
                        Property + indexes (pg_trgm GIN on city is created in migration SQL)
  src/schema.graphql    the contract
  src/server.ts         createYoga({ schema, context }) on node:http; PORT from env
  src/app.ts            createYoga({ schema: createSchema({ typeDefs, resolvers }), context })
  src/db.ts             PrismaClient with @prisma/adapter-pg (Prisma 7 needs a driver adapter)
  src/context.ts        Context = { services }; server.ts builds prisma → repositories → services
  src/env.ts            Zod-parsed env (DATABASE_URL, WEATHERSTACK_BASE_URL, WEATHERSTACK_ACCESS_KEY, PORT)
  src/weatherstack/     client.ts (fetch + AbortSignal.timeout(5000) + Zod parse), types
  src/repositories/  src/services/  src/resolvers/
  test/setup.ts         MSW server: beforeAll listen({ onUnhandledRequest: 'error' }), afterEach reset, afterAll close
  test/handlers.ts      Weatherstack handlers: ok (Fountain Hills fixture), successFalse, serverError, timeout, malformed
  test/fixtures/        weatherstack-current.json (real response shape, lat/lon as strings)
  vitest.config.ts      setupFiles test/setup.ts; env: WEATHERSTACK_ACCESS_KEY=test-key,
                        WEATHERSTACK_BASE_URL=http://weatherstack.test, DATABASE_URL=TEST_DATABASE_URL
```

Scripts: `dev` (tsx watch src/server.ts), `build` (tsc -p tsconfig.build.json or tsup), `typecheck`
(tsc --noEmit), `codegen` (graphql-codegen), `test` (vitest run), `test:unit` (vitest run
--project unit, or a path filter that excludes `*.int.test.ts`), `db:migrate`, `db:reset`.

Integration tests (`*.int.test.ts`) need postgres-test. Global setup runs `prisma migrate deploy`
against it; tests call `resetTables()` (TRUNCATE) in `beforeEach`. Don't use `migrate reset`: Prisma
blocks it when run by an AI agent unless the user consents each time.

## apps/web

```
apps/web/
  package.json          name "web"; scripts dev, build, typecheck, codegen, test, test:unit, e2e
  vite.config.ts        react plugin, tailwind, @ alias
  codegen.ts            schema: ../api/src/schema.graphql; documents: src/**/*.{ts,tsx,graphql};
                        preset client → src/gql/
  components.json       shadcn init (add only components you use)
  src/main.tsx          ApolloProvider + RouterProvider
  src/apollo.ts         ApolloClient(uri: import.meta.env.VITE_GRAPHQL_URL, InMemoryCache)
  src/routes/           properties list (filter + sort), property detail, new property
  src/test/setup.ts     MSW node server with graphql handlers, onUnhandledRequest: 'error'
  e2e/                  one Playwright spec (SPEC X4) + weatherstack-stub.mjs (node:http, serves fixture)
  playwright.config.ts  webServer: stub (:4999), api with WEATHERSTACK_BASE_URL=http://localhost:4999
                        and DATABASE_URL=TEST_DATABASE_URL, web dev server
```

## Root wiring

- Root scripts already fan out with `pnpm -r --if-present`, so give each app the same script names.
- Add a README "Run it" section once the api serves: `cp .env.example .env`, `docker compose up -d --wait postgres postgres-test`,
  `pnpm install`, `pnpm --filter api exec prisma migrate deploy`, `pnpm dev`.
