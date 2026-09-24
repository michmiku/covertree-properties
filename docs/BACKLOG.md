# Backlog

Work that is known but not scheduled. [SPEC.md](SPEC.md) stays the contract for what ships; an
item moves from here into the SPEC (with criteria) when it is picked up.

## Deferred review findings

From the 2026-09-24 full review (reviewer agent, security review, `/code-review`, `/simplify`).
The reviewer reported 44/44 PASS; none of these block P0. Fixed items from that review are in the
git log (`8499d6a`..`fbd8e43`).

### Security and hardening

- [ ] **Auto-allowed commands can read `.env`.** `.claude/settings.json` allows
      `Bash(pnpm exec *)` and `Bash(docker compose exec *)`, either of which can print environment
      variables and bypass the `.env` read deny. The archiver now redacts exact `.env` values, so
      this is defense in depth. Narrow or remove the two entries.
- [ ] **Rate limiting.** S5.9 caps `createProperty` at one per request; separate requests are
      unlimited. Add per-IP limiting in front of the API (reverse proxy) before it is exposed.
- [ ] **CI permissions and pinning.** Add `permissions: contents: read` to `ci.yml`; pin actions
      to commit SHAs.
- [ ] **Production defaults.** GraphiQL is off and CORS allows only `WEB_ORIGIN`; still disable
      introspection when `NODE_ENV=production` and add nginx security headers (CSP, `nosniff`,
      `frame-ancestors`) and `gzip on`.
- [ ] **Pin the Playwright MCP.** `.mcp.json` runs `@playwright/mcp@latest`.
- [ ] **Integration tests lack a test-database guard.** `test/database.ts` truncates whatever
      `TEST_DATABASE_URL` points at; Playwright refuses anything but `:5433`. Share one
      `assertTestDatabase` from `apps/api/test/test-database-url.ts` (also removes the copied
      default URL in `playwright.config.ts`).
- [ ] **Prisma CLI in the API image.** `@prisma/client` peers on `prisma`, so the CLI, Studio,
      React and TypeScript ship in the runtime image (786 MB), including 6 `pnpm audit` findings
      that are not on the request path. Revisit on the next Prisma release.
- [ ] **Icon URLs.** The API stores `weather_icons` as Weatherstack returns them, so a bad or
      compromised upstream response could set any URL (`<img src>`, no script execution). Optionally accept only
      known Weatherstack hosts over https.

### Design (fix at the right layer)

- [ ] `createServices(env, prisma, overrides)` so `create-property.int.test.ts` stops hand-wiring
      the service graph.
- [ ] Shared integration `setupFiles` (reset tables, disconnect) and a `test/app.ts` helper,
      instead of repeating them in every `*.int.test.ts`.
- [ ] Separate e2e database (e.g. `covertree_e2e`), so e2e and integration tests can't interfere
      and e2e can assert on a known state instead of `Date.now()` streets and before/after diffs.
- [ ] The repository owns id handling: `findById`/`deleteById` treat a malformed id as not found,
      and `deleteById` returns the stored id, instead of each service calling `isPropertyId` and
      `toLowerCase()`.
- [ ] Parse stored `weatherData` at the repository with the `WeatherstackCurrent` Zod schema and
      trim descriptions once on ingest, instead of the resolver casting JSON and trimming on read.
- [ ] Keep `readEnv` pure: call `loadRootEnv()` at the entrypoints, not inside `readEnv` based on
      `source === process.env`.
- [ ] Remount `PropertyFilters` with a `key` instead of syncing `draft` via `prevApplied`.
- [ ] Move the stub's constants (`FAILING_ZIP`, base URL) into a side-effect-free module that the
      stub, e2e spec and api test helpers import.
- [ ] Domain copies of GraphQL enums (`WeatherFailureReason`, `'ASC' | 'DESC'`) get no compile
      error when the schema adds a value. Add a type-level check in the resolvers.

### Duplication

- [ ] Web: one `US_STATES` + `<StateSelect>`; one zip rule/message (5 copies across web and api);
      shared `Field`; shared `<LoadError>`, date formatter, address and weather-summary helpers
      for list and detail; early returns instead of the list's nested ternary; plain
      `update(field, value)`; drop `routes/home.tsx`, the overwritten `...NO_FILTER` spread, and
      `CreatePropertyInput` (it is `Address`).
- [ ] Tests: `listedProperty`, `serveProperties`, `respondWith` into `src/test/properties.ts`;
      `app.test.ts` via `executeOperation`; `vitest.config.ts` imports the Weatherstack test
      constants; shared `expectedWeather` and `TEST_ADDRESS`; `withCurrent` next to the other
      Weatherstack handlers.
- [ ] Hooks: one `targetFile(input)` helper in `.claude/hooks/lib.mjs`; compose `x-` anchor for
      the two Postgres services.

### Efficiency

- [ ] Dockerfile: `COPY . .` precedes install, so any edit reinstalls and rebuilds both apps.
      Copy manifests and codegen inputs first, then each app in its own stage.
- [ ] CI: buildx `type=gha` cache for the docker job; cache Playwright browsers; the e2e job's
      `pnpm run build` is unused (e2e runs dev servers).
- [ ] Create mutation selects the detail fields (shared fragment with `property.query.ts`), so the
      detail page after create renders from the cache.
- [ ] Hooks: call `node_modules/.bin/*` directly instead of `pnpm exec`; run typecheck and unit
      tests in parallel in the Stop hook; fold `codegen.mjs` into the format hook.
- [ ] Minor: seed `filter-properties.int.test.ts` once per file; build `redact()` rules once.

### Nits

- [ ] Restated defaults: compose `WEATHERSTACK_BASE_URL`/`PORT`, `vite.config.ts` port, possibly
      unused CI `env` entries (unverified).
- [ ] `scripts/lib/render.mjs` duplicate heading logic; alias in `test/global-setup.int.ts`;
      unneeded spread in `weatherstack/client.test.ts`.

## Proposed features

Each entry is a proposal, not a commitment. When one is picked up, write its criteria into the
SPEC (P1 or a new story), then build it with `/graphql-slice`.

### F1 · Maps on the list and detail pages

**Problem.** Properties are stored with coordinates (S7 `lat`/`long`), but the UI only prints
the numbers. A map shows where the filtered properties are relative to each other, and where a
single property is.

**Proposal.**

- **List:** a map next to the list (stacked above it on narrow screens, or a List/Map toggle)
  with one marker per property in the current filtered and sorted result. The map fits its bounds
  to the markers. A marker popup shows the street and links to the detail page, keeping the list
  URL (same as the row links).
- **Detail:** a small map centred on the property with one marker, under the coordinates.
- **Data:** no API or schema change and no Weatherstack calls. The detail query already selects
  `lat`/`long`; add them to `properties.query.ts` for the list (then `pnpm codegen`).

**Library.** Leaflet via `react-leaflet` with OpenStreetMap tiles needs no key and is the
smallest step. OSM's tile policy asks for attribution and forbids heavy use, so the tile URL
should come from `VITE_MAP_TILE_URL` (defaulting to OSM) for a production provider later.
MapLibre GL with vector tiles is the alternative if styling or clustering matters more; it
usually needs a provider key.

**Draft criteria** (to become SPEC IDs):

- The list map shows exactly one marker per property in the current result and updates with
  filters and sort; an empty result shows the map without markers (the list's empty states stay).
- Selecting a marker's link opens that property's detail page and "All properties" returns to
  the same filtered list.
- The detail map is centred on the property's `lat`/`long` with one marker.
- The map makes no API or Weatherstack requests; tiles come from the configured URL and the
  attribution is visible.
- The list stays the primary, accessible view: the map has an accessible name, and nothing is
  reachable only through the map.
- Tests never load real tiles: unit tests replace the map component (jsdom can't render it) and
  assert the markers it receives; e2e routes tile requests to an empty response and asserts marker
  count.

**Open questions.**

- Tile provider and usage limits if this goes beyond local use.
- Bounds when results span US territories (e.g. PR and GU in one result zooms out to the
  Pacific): fit all, or prefer the contiguous US?
- Marker clustering once the list grows (ties to P2 pagination).
- Load the map code lazily so the list's first render doesn't wait for it.
- A CSP (see Production defaults above) must allow the tile host.
