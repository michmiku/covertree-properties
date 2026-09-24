---
name: verify
description: Run the full quality gate for the property app (Postgres up, `pnpm verify` = format, lint, typecheck, all tests, build, e2e) and then smoke-test the running UI in a real browser via the Playwright MCP, reporting each failure with its likely cause. Use this before any commit or PR, after finishing a story, when the user asks "does everything pass?", "is it green?", "check it works", "run the checks", or wants to confirm the app actually runs, even if they don't say "verify".
---

# Verify

The Stop hook already typechecks and unit-tests after every turn. This skill is the **full** gate:
the checks that need Docker, a build, or a browser, plus judgment about what a failure means.
`pnpm verify` is the single source of truth, and CI runs the same script, so don't reimplement its
steps here.

## 1. Database

Run `docker compose ps`. If Docker itself isn't running (connection refused), tell the user to
start OrbStack/Docker Desktop and stop there. Otherwise run `docker compose up -d --wait postgres postgres-test` (naming the services;
the default set also starts the api/web containers on :4000/:5173) so both
`postgres` and `postgres-test` are healthy before tests start. If the api exists, apply migrations
to the dev DB with `pnpm --filter api exec prisma migrate deploy`.

## 2. The gate

Run `pnpm run verify`. It stops at the first failing stage, in this order: format:check → lint →
typecheck → test → build → e2e. For the failing stage:

- **format:check:** run `pnpm run format`; nothing to diagnose.
- **lint:** a `no-restricted-imports` error means a layering violation (see CLAUDE.md). Move the
  code to the right layer; don't disable the rule.
- **typecheck:** first check whether codegen is stale (`pnpm run codegen`, then retry). Stale
  generated types are the most common cause after a schema edit.
- **test:** an MSW `onUnhandledRequest` error means code is calling a URL with no handler, often
  the real Weatherstack. That's a bug in the code or a missing handler, never a reason to relax the
  setting.
- **e2e:** check that the Weatherstack stub and api `webServer`s started (port conflicts, missing
  migrations on the test DB).

Fix what's clearly in scope for the current work and re-run. Otherwise report it.

## 3. UI smoke (only if `apps/web` exists)

A green e2e run proves the scripted path. This step is a human-style look at the running app, to
catch what assertions miss: broken layout, console errors, confusing states.

1. Start the stack in the background against the **Weatherstack stub**, not the real API, so no
   quota is spent. Use the e2e stub
   (`node apps/web/e2e/weatherstack-stub.mjs`) and start the api with
   `WEATHERSTACK_BASE_URL=http://localhost:4999`, then `pnpm dev`. Use the real API only if the user
   explicitly asks.
2. Using the Playwright MCP tools, walk the SPEC X4 path with the PDF example (15528 E Golden Eagle
   Blvd, Fountain Hills, AZ 85268): create → it appears in the list with weather → filter by
   city/zip/state → open detail (lat/long, weather) → delete → it's gone.
3. Take a screenshot of the list and detail pages, and read the browser console for errors.
4. Stop the background processes you started.

## 4. Report

Use exactly this shape:

```
## Verify: PASS | FAIL
| Stage | Result | Notes |
|---|---|---|
| database | ✅ | postgres, postgres-test healthy |
| format · lint · typecheck | ✅ | |
| test | ❌ | 2 failing: S5.5 timeout case (apps/api/test/…:88) |
| build · e2e | ⏭ skipped | gate stopped at test |
| UI smoke | ⏭ / ✅ / ❌ | console errors, screenshots |

**Likely cause:** <one or two sentences per failure, pointing at file:line>
**Next step:** <the concrete fix, or what you need from the user>
```

Only report PASS when every stage ran and passed. A skipped stage is not a pass.
